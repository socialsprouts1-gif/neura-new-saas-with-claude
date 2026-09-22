-- Neura Chat — the latest database updates
--
-- Paste the whole file into the Supabase SQL editor and press Run.
--
-- Safe to run more than once. Every statement either creates something
-- only if it is missing, replaces a function outright, or drops a policy
-- before recreating it — so running this twice changes nothing the second
-- time, and running it when you are already up to date is a no-op.
--
-- Run it top to bottom in one go. The sections are in dependency order.
--
-- What is in here, newest last:
--
--   1. Seven-day trial                  — the trial length every new
--                                         workspace gets
--   2. Platform admin sees every org    — admin screens could only see
--                                         workspaces you belong to
--   3. Email transport columns          — records how each message was
--                                         sent and as whom
--   4. Email opt-outs                   — the unsubscribe list, needed
--                                         before unsubscribe links work
--   5. Meetings + scheduled messages    — meeting platform and link, and
--                                         the queue for messages written
--                                         now and sent later
--   6. Group sending                    — a default number per group and
--                                         a record of what was sent
--
-- Sections 5 and 6 are today's. The four before them are included because
-- they are harmless to re-run and this way it does not matter whether you
-- got to them.



-- =====================================================================
-- 20260922090000_trial_seven_days.sql
-- =====================================================================

-- The free trial is seven days.
--
-- It was seeded at fourteen and the number was also written into five
-- files as a fallback. Those now read a single constant, and this brings
-- the stored setting in line with it — a default that disagrees with
-- itself is worse than a wrong one, because the banner counts down from a
-- different number than the welcome email promised and neither matches
-- what the database actually gave.
--
-- Only the setting changes. Workspaces already trialling keep the end date
-- they were given: shortening somebody's trial underneath them, for a
-- change they never asked for, is not a default change — it is taking
-- something back.

update public.platform_settings
set value = jsonb_set(coalesce(value, '{}'::jsonb), '{trial_days}', '7'::jsonb),
    updated_at = now()
where key = 'billing';

insert into public.platform_settings (key, value, description)
values ('billing', '{"trial_days":7}'::jsonb, 'Length of the free trial given to a new workspace, in days')
on conflict (key) do nothing;

notify pgrst, 'reload schema';


-- =====================================================================
-- 20260923090000_platform_admin_workspaces.sql
-- =====================================================================

-- A platform admin can see and administer every workspace.
--
-- organizations and org_members were the only two tables left whose
-- policies read `is_org_member` / `is_org_admin` with no platform-admin
-- exception. Every other tenant table already has one. The effect was that
-- the admin panel showed staff their own workspaces and nobody else's:
-- /admin/organizations listed the handful the admin happened to belong to,
-- so three fresh signups appeared to have created nothing at all.
--
-- The writes failed worse than the reads. Postgres does not error on an
-- UPDATE whose rows are filtered out by RLS — it reports zero rows changed,
-- which PostgREST returns as success. So changing somebody's role, editing
-- feature overrides and suspending a workspace all came back with a green
-- confirmation and changed nothing. "It is not changing" with no error on
-- screen is exactly what that looks like from the outside.

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member(id) or public.is_platform_admin());

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_org_admin(id) or public.is_platform_admin())
  with check (public.is_org_admin(id) or public.is_platform_admin());

drop policy if exists org_members_select on public.org_members;
create policy org_members_select on public.org_members
  for select to authenticated
  using (public.is_org_member(org_id) or public.is_platform_admin());

drop policy if exists org_members_insert on public.org_members;
create policy org_members_insert on public.org_members
  for insert to authenticated
  with check (public.is_org_admin(org_id) or public.is_platform_admin());

drop policy if exists org_members_update on public.org_members;
create policy org_members_update on public.org_members
  for update to authenticated
  using (public.is_org_admin(org_id) or public.is_platform_admin())
  with check (public.is_org_admin(org_id) or public.is_platform_admin());

drop policy if exists org_members_delete_admin on public.org_members;
create policy org_members_delete_admin on public.org_members
  for delete to authenticated
  using (public.is_org_admin(org_id) or public.is_platform_admin());

-- ---------------------------------------------------------------------

-- What role the person who creates a workspace is given.
--
-- Settable, because it is a policy decision rather than a fact about the
-- software. It defaults to owner, and that default is deliberate: owner and
-- admin are the roles that may connect a WhatsApp number, open billing,
-- manage integrations and invite anybody. A workspace whose only member is
-- a plain member cannot be set up by the person who just signed up for it —
-- they would have to ask support before they could send a single message,
-- which is a strange way to start a seven-day trial.
--
-- Change it from Admin → Settings → New signups when that is what you want.
create or replace function public.signup_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select value ->> 'default_role'
       from public.platform_settings
      where key = 'signups'
        and value ->> 'default_role' in ('owner', 'admin', 'member')),
    'owner'
  );
$$;

grant execute on function public.signup_role() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  org_name text;
begin
  org_name := coalesce(
    new.raw_user_meta_data ->> 'org_name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(new.email, '@', 1),
    'My Organization'
  );

  insert into public.organizations (name)
  values (org_name)
  returning id into new_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (new_org_id, new.id, public.signup_role());

  insert into public.profiles (user_id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;

  insert into public.subscriptions (org_id, status, current_period_start, current_period_end)
  values (
    new_org_id,
    'trialing',
    now(),
    now() + make_interval(days => public.trial_days())
  )
  on conflict (org_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The repair path gives the same role as the signup trigger, so which of
-- the two happened to create a workspace is not something anybody can tell
-- from the outside.
create or replace function public.provision_org_for_user(
  target_user uuid,
  org_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing uuid;
  created uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_user::text, 0));

  select org_id into existing
  from public.org_members
  where user_id = target_user
  order by created_at
  limit 1;

  if existing is not null then
    return existing;
  end if;

  insert into public.organizations (name)
  values (coalesce(nullif(btrim(org_name), ''), 'My Organization'))
  returning id into created;

  insert into public.org_members (org_id, user_id, role)
  values (created, target_user, public.signup_role());

  insert into public.subscriptions (org_id, status, current_period_start, current_period_end)
  values (
    created,
    'trialing',
    now(),
    now() + make_interval(days => public.trial_days())
  )
  on conflict (org_id) do nothing;

  return created;
end;
$$;

revoke all on function public.provision_org_for_user(uuid, text) from public;
revoke all on function public.provision_org_for_user(uuid, text) from anon, authenticated;

notify pgrst, 'reload schema';


-- =====================================================================
-- 20260924090000_email_transport.sql
-- =====================================================================

-- Record how each message was sent, and as whom.
--
-- The log could say a message was accepted and nothing else. When one was
-- accepted and never arrived, the two facts that decide why — which
-- transport carried it, and what from address it claimed — were exactly
-- the two the log did not keep. A message sent through one provider while
-- claiming to come from another provider's domain fails DMARC at the
-- receiving server: accepted, then filed as spam or dropped. From the
-- sending end that is indistinguishable from a message that arrived.

alter table email_log
  add column if not exists transport text,
  add column if not exists from_email text;

comment on column email_log.transport is
  'resend or smtp: which way this message left';
comment on column email_log.from_email is
  'The from address claimed, which is what DMARC is checked against';

notify pgrst, 'reload schema';


-- =====================================================================
-- 20260925090000_email_optouts.sql
-- =====================================================================

-- People who have asked not to receive the nudges.
--
-- Needed before a List-Unsubscribe header can honestly be put on a
-- message: claiming one-click unsubscribe and then carrying on sending is
-- worse than not offering it, and Gmail checks by sending the request.
--
-- Account mail is deliberately not covered. A receipt, a welcome and a
-- "your subscription ended" are things that happened to somebody's
-- account, and suppressing those would hide money moving.

create table if not exists email_optouts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  -- Kept for support ("who unsubscribed and when"), and null when somebody
  -- unsubscribes from a link without us knowing which workspace they are.
  org_id uuid references organizations(id) on delete set null,
  source text not null default 'link',
  created_at timestamptz not null default now()
);

-- Lowercased, so Foo@x.com and foo@x.com cannot both be on the list with
-- only one of them ever matching.
create unique index if not exists email_optouts_email_idx
  on email_optouts (lower(email));

alter table email_optouts enable row level security;

-- Written by the unsubscribe route and read by the sender, both of which
-- use the service role. No tenant has a reason to read this through the
-- API, and it holds addresses belonging to other workspaces.
drop policy if exists "email_optouts service only" on email_optouts;
create policy "email_optouts service only" on email_optouts
  for all using (false) with check (false);

notify pgrst, 'reload schema';


-- =====================================================================
-- 20260926090000_meetings_and_scheduled_messages.sql
-- =====================================================================

-- Meetings that say where they are, and messages that go out later.
--
-- Two changes that belong together because they are the same idea: a
-- commitment made now that has to reach the customer at the right moment.

-- ---------------------------------------------------------------------
-- Meetings: where it happens, on which number, and whether the customer
-- has been told.
-- ---------------------------------------------------------------------

alter table public.meetings
  -- google_meet, zoom, calendly, phone, in_person, other. Text rather than
  -- an enum so adding one is a deploy, not a migration and a deploy.
  add column if not exists platform text,
  -- The joining link. Separate from `location`, which is free text and is
  -- what somebody types for an office address.
  add column if not exists meeting_url text,
  -- Which WhatsApp number the confirmation goes out on. A workspace with
  -- two numbers has two, and a confirmation arriving from the one the
  -- customer has never messaged reads as a scam.
  add column if not exists connection_id uuid references public.waba_connections(id) on delete set null,
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists confirmation_error text;

comment on column public.meetings.platform is
  'Where the meeting happens: google_meet, zoom, calendly, phone, in_person, other';
comment on column public.meetings.meeting_url is
  'The joining link, when the platform has one';

-- ---------------------------------------------------------------------
-- Scheduled messages
-- ---------------------------------------------------------------------

-- Writing a message now and having it delivered later.
--
-- The case this exists for: a follow-up that should land tomorrow morning,
-- written today because tomorrow morning is not a time anybody is
-- reliably at a keyboard.
--
-- Deliberately its own table rather than a campaign of one. A campaign
-- carries an audience, a template and a dispatch policy; this carries one
-- message to one person at one time, and modelling it as a campaign would
-- mean every screen about campaigns had to explain the degenerate case.
create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  -- Kept alongside contact_id: a contact deleted between scheduling and
  -- sending should not silently turn into a message with no recipient.
  wa_id text not null,
  connection_id uuid references public.waba_connections(id) on delete set null,
  body text not null,
  send_at timestamptz not null,
  -- pending, sent, failed, cancelled
  status text not null default 'pending',
  sent_at timestamptz,
  error text,
  wa_message_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The sweep asks "what is due, across every workspace" on every run.
create index if not exists scheduled_messages_due_idx
  on public.scheduled_messages (status, send_at)
  where status = 'pending';

create index if not exists scheduled_messages_org_idx
  on public.scheduled_messages (org_id, send_at desc);

alter table public.scheduled_messages enable row level security;

drop policy if exists scheduled_messages_select on public.scheduled_messages;
create policy scheduled_messages_select on public.scheduled_messages
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists scheduled_messages_insert on public.scheduled_messages;
create policy scheduled_messages_insert on public.scheduled_messages
  for insert to authenticated with check (public.is_org_member(org_id));

drop policy if exists scheduled_messages_update on public.scheduled_messages;
create policy scheduled_messages_update on public.scheduled_messages
  for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists scheduled_messages_delete on public.scheduled_messages;
create policy scheduled_messages_delete on public.scheduled_messages
  for delete to authenticated using (public.is_org_member(org_id));

notify pgrst, 'reload schema';


-- =====================================================================
-- 20260927090000_group_sending.sql
-- =====================================================================

-- A default number for a group, and a record of what was sent to it.
--
-- A group here is a named segment of contacts, not a WhatsApp group.
-- Meta's Cloud API has no group endpoints at all — groups exist only in
-- the consumer and Business apps, and every tool that claims otherwise is
-- driving an unofficial library that gets numbers banned. So a "broadcast"
-- is one message to each member, sent individually, which is also what
-- reaches people who have muted a group.

alter table public.contact_groups
  -- Which number this segment is usually messaged from. A default rather
  -- than a constraint: the same people can be written to from either
  -- number, and the picker on the send still decides.
  add column if not exists connection_id uuid references public.waba_connections(id) on delete set null;

comment on column public.contact_groups.connection_id is
  'Default WhatsApp number for broadcasts to this group. Not a WhatsApp group — no such API exists.';

-- What went out to a group, so a second look answers "did I already send
-- this" without counting rows in the message log.
create table if not exists public.group_broadcasts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.contact_groups(id) on delete cascade,
  connection_id uuid references public.waba_connections(id) on delete set null,
  body text not null,
  sent_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists group_broadcasts_group_idx
  on public.group_broadcasts (group_id, created_at desc);

alter table public.group_broadcasts enable row level security;

drop policy if exists group_broadcasts_select on public.group_broadcasts;
create policy group_broadcasts_select on public.group_broadcasts
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists group_broadcasts_insert on public.group_broadcasts;
create policy group_broadcasts_insert on public.group_broadcasts
  for insert to authenticated with check (public.is_org_member(org_id));

notify pgrst, 'reload schema';


-- =====================================================================
-- Done. Reload the app and the new screens will be there.
-- =====================================================================
