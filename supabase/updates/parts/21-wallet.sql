-- =========================================================================
-- The message wallet — money in, and what each send costs
-- =========================================================================
-- A workspace tops the wallet up, and every template that goes out takes
-- its price off the balance. The point of it is the statement: a customer
-- who can see "4,312 messages, ₹4,096" has an answer to where the money
-- went, and a customer who cannot see it assumes the worst.
--
-- Two decisions worth stating, because both are easy to get wrong in a way
-- that costs somebody real money.
--
-- The balance is a column, not a sum over the ledger. A running total
-- recomputed on every send is a table scan per message at exactly the
-- moment throughput matters, and two sends landing together both read the
-- same stale total. So the column is the truth, the ledger is the
-- explanation, and one function writes both together under a row lock.
--
-- The prices are the platform's own, set in Admin. They are not Meta's
-- rates and this does not try to guess them: Meta bills the WhatsApp
-- account directly, in its own currency, on its own schedule. What this
-- counts is what this business charges its own customers.

alter table public.organizations
  add column if not exists wallet_balance_cents integer not null default 0;

alter table public.organizations
  add column if not exists wallet_currency text not null default 'INR';

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  -- topup: money in. debit: a message went out. refund and adjustment are
  -- us putting something right, and are deliberately distinguishable from
  -- the first two in a statement.
  kind text not null check (kind in ('topup', 'debit', 'refund', 'adjustment')),
  -- Always positive. The kind says which way it moves, so a stray minus
  -- sign cannot turn a charge into a credit.
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'INR',
  -- The running balance after this row, so a statement reads top to bottom
  -- without replaying every row before it.
  balance_after_cents integer not null,
  description text not null,
  -- What it was for: a WhatsApp message id, a payment id, an admin's note.
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_ledger_org_idx
  on public.wallet_ledger(org_id, created_at desc);

-- A debit is written once per message. The index is what makes that true
-- even when a batch is retried after a timeout: the second attempt loses
-- the insert instead of charging again.
create unique index if not exists wallet_ledger_reference_idx
  on public.wallet_ledger(org_id, kind, reference)
  where reference is not null;

alter table public.wallet_ledger enable row level security;

-- Readable by the workspace, written by nobody but the server. A ledger
-- a tenant can insert into is a wallet that tops itself up.
drop policy if exists wallet_ledger_read on public.wallet_ledger;
create policy wallet_ledger_read on public.wallet_ledger
  for select to authenticated
  using (public.is_org_member(org_id));

/**
 * Moves the balance and writes the line that explains it, together.
 *
 * Under a row lock on the organization, so two sends landing in the same
 * millisecond cannot both read the same balance and both write it back.
 * Returns the new balance, or null when the move was refused.
 *
 * p_allow_negative is the switch between "count what was spent" and
 * "stop when the money runs out". It defaults to true, because a wallet
 * that silently stops a customer's campaign the moment a rate is set
 * wrong is worse than one that goes briefly negative and says so.
 */
create or replace function public.wallet_move(
  p_org_id uuid,
  p_kind text,
  p_amount_cents integer,
  p_description text,
  p_reference text default null,
  p_allow_negative boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
  v_next integer;
  v_currency text;
begin
  if p_amount_cents is null or p_amount_cents < 0 then
    return null;
  end if;

  select wallet_balance_cents, wallet_currency
    into v_balance, v_currency
  from public.organizations
  where id = p_org_id
  for update;

  if not found then
    return null;
  end if;

  if p_kind in ('topup', 'refund') then
    v_next := v_balance + p_amount_cents;
  elsif p_kind in ('debit', 'adjustment') then
    v_next := v_balance - p_amount_cents;
  else
    return null;
  end if;

  if v_next < 0 and not p_allow_negative then
    return null;
  end if;

  -- The unique index on (org_id, kind, reference) is what makes a retried
  -- batch harmless. Losing that insert is the correct outcome, not an
  -- error: it means this message has already been charged for.
  begin
    insert into public.wallet_ledger
      (org_id, kind, amount_cents, currency, balance_after_cents, description, reference)
    values
      (p_org_id, p_kind, p_amount_cents, coalesce(v_currency, 'INR'), v_next, p_description, p_reference);
  exception when unique_violation then
    return v_balance;
  end;

  update public.organizations
  set wallet_balance_cents = v_next
  where id = p_org_id;

  return v_next;
end;
$$;

revoke all on function public.wallet_move(uuid, text, integer, text, text, boolean) from public;
revoke all on function public.wallet_move(uuid, text, integer, text, text, boolean) from anon, authenticated;
