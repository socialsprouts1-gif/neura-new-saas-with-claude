-- Neura Chat — database update for 2026-09
--
-- The migrations added in 2026-09, and nothing else. Paste this into the
-- Supabase SQL editor and press Run.
--
-- Safe to run more than once, and safe to run out of order with other
-- months: tables use "if not exists", columns use "add column if not
-- exists", functions use "create or replace", and every policy is dropped
-- before being recreated.
--
-- If this is a brand new database, run supabase/setup.sql instead — it
-- contains every migration from the beginning.
--
-- Regenerate with: node scripts/build-setup-sql.mjs


-- ========================================================================
-- 20260901090000_ai_active_default.sql
-- ========================================================================

-- =========================================================================
-- AI Active is the default, not Copilot.
--
-- Copilot was the cautious choice: AI drafts, a human sends. But a WhatsApp
-- automation product whose bots do not answer until someone presses a button
-- is not doing the thing it was bought for. A tenant who wants a human in
-- the loop can still pick Copilot per conversation.
-- =========================================================================

alter table public.conversations
  alter column ai_mode set default 'ai';

-- Conversations still sitting on the old default have never had a mode
-- chosen for them — nobody picked Copilot, it was picked for them. Move
-- those over, and only those: a conversation someone deliberately set to
-- 'human' stays where they put it.
--
-- bot_enabled is what the message runner actually reads, so the two have to
-- agree or the mode becomes a label over the wrong behaviour.
update public.conversations
set ai_mode = 'ai',
    bot_enabled = true
where ai_mode = 'copilot'
  and bot_enabled = true;

-- ========================================================================
-- 20260902090000_leads_meetings_transactions.sql
-- ========================================================================

-- =========================================================================
-- Meetings and customer transactions.
--
-- The Leads board and Lead Status screens need no new tables: lead_stage,
-- lead_score and source already live on contacts. These two do.
-- =========================================================================

-- =========================================================================
-- meetings — an appointment with a contact.
--
-- Separate from reminders: a reminder nudges you, a meeting is a commitment
-- to somebody else, with a duration and an outcome.
-- =========================================================================
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null,
  notes text,
  location text,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meetings_org_idx on public.meetings(org_id, starts_at);
create index if not exists meetings_contact_idx on public.meetings(contact_id);

alter table public.meetings enable row level security;

drop policy if exists meetings_select on public.meetings;
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists meetings_insert on public.meetings;
drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert on public.meetings
  for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists meetings_update on public.meetings;
drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings
  for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists meetings_delete on public.meetings;
drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete on public.meetings
  for delete to authenticated using (public.is_org_member(org_id));

-- =========================================================================
-- transactions — money between the business and its customers.
--
-- Not to be confused with public.orders, which is what the tenant pays the
-- platform. This is what the tenant's own customers pay the tenant.
-- =========================================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  -- Stored in the smallest unit so no arithmetic here ever meets a float.
  amount_cents bigint not null default 0,
  currency text not null default 'INR',
  direction text not null default 'in' check (direction in ('in', 'out')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),
  method text,
  reference text,
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists transactions_org_idx on public.transactions(org_id, occurred_at desc);
create index if not exists transactions_contact_idx on public.transactions(contact_id);

alter table public.transactions enable row level security;

drop policy if exists transactions_select on public.transactions;
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists transactions_update on public.transactions;
drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists transactions_delete on public.transactions;
drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete to authenticated using (public.is_org_member(org_id));

-- ========================================================================
-- 20260903090000_templates_campaigns.sql
-- ========================================================================

-- =========================================================================
-- Templates that can be built, and campaigns that can be sent.
--
-- message_templates held a name and a components blob, which was enough to
-- send an already-approved template and not enough to build one. campaigns
-- held a segment filter and no way to say who, with what, or when.
-- =========================================================================

alter table public.message_templates
  -- Meta's own id, and the status it reports back after review.
  add column if not exists waba_template_id text,
  add column if not exists rejected_reason text,
  add column if not exists last_synced_at timestamptz,
  -- The parts, kept separately so the builder can reopen a template rather
  -- than reverse-engineering it out of the components array.
  add column if not exists header_format text not null default 'NONE',
  add column if not exists header_text text not null default '',
  add column if not exists header_media_url text not null default '',
  add column if not exists body_text text not null default '',
  add column if not exists footer_text text not null default '',
  add column if not exists buttons jsonb not null default '[]'::jsonb,
  add column if not exists variable_samples text[] not null default '{}';

alter table public.message_templates drop constraint if exists message_templates_header_format_check;
alter table public.message_templates add constraint message_templates_header_format_check
  check (header_format in ('NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'));

-- Meta reports more states than the original four.
alter table public.message_templates drop constraint if exists message_templates_status_check;
alter table public.message_templates add constraint message_templates_status_check
  check (status in ('draft', 'pending', 'approved', 'rejected', 'disabled', 'paused', 'in_appeal'));

create index if not exists message_templates_waba_idx
  on public.message_templates(org_id, waba_template_id);

alter table public.campaigns
  add column if not exists name text not null default 'Untitled campaign',
  -- Values for the template's {{1}}, {{2}} … Fixed per campaign; a
  -- per-recipient merge would need a column mapping, which is the next step.
  add column if not exists variables text[] not null default '{}',
  -- How the audience was chosen, kept so the campaign can be reopened and
  -- audited: { kind: 'all' | 'tag' | 'group' | 'numbers', value: ... }
  add column if not exists audience jsonb not null default '{}'::jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_error text,
  -- A drip is a campaign whose steps fire on a delay after the first send.
  add column if not exists is_drip boolean not null default false;

alter table public.campaign_recipients
  -- Denormalised so a send does not need a contact join, and so a number
  -- pasted in or imported can be dispatched before it becomes a contact.
  add column if not exists wa_id text,
  add column if not exists wa_message_id text,
  add column if not exists error text,
  -- Which drip step this row is for. 0 is the campaign's own first send.
  add column if not exists step_index integer not null default 0,
  add column if not exists send_after timestamptz;

-- contact_id has to allow null now: a pasted number is dispatchable before
-- it exists as a contact, and forcing one would create junk contacts for
-- numbers that turn out to be unreachable.
alter table public.campaign_recipients
  alter column contact_id drop not null;

-- Who this row is for, as one value: a contact when there is one, the raw
-- number when there is not. A generated column rather than an expression
-- index because ON CONFLICT can only name real columns — PostgREST's
-- on_conflict= takes column names, and an expression index would make
-- every upsert fail with "no unique or exclusion constraint matching".
alter table public.campaign_recipients
  add column if not exists recipient_key text
  generated always as (coalesce(contact_id::text, wa_id)) stored;

-- Every row must identify somebody, or the key above would be null and two
-- empty rows would both be allowed through.
alter table public.campaign_recipients
  drop constraint if exists campaign_recipients_has_target;
alter table public.campaign_recipients
  add constraint campaign_recipients_has_target
  check (contact_id is not null or wa_id is not null) not valid;

-- The old key assumed one row per contact per campaign. A drip needs one
-- per step.
alter table public.campaign_recipients
  drop constraint if exists campaign_recipients_campaign_id_contact_id_key;
drop index if exists public.campaign_recipients_step_key;
create unique index if not exists campaign_recipients_step_key
  on public.campaign_recipients(campaign_id, recipient_key, step_index);

create index if not exists campaign_recipients_due_idx
  on public.campaign_recipients(status, send_after)
  where status = 'pending';

-- =========================================================================
-- campaign_steps — the drip sequence.
--
-- Step 0 is the campaign's own message. Anything beyond is sent this many
-- hours after the step before it, to the recipients who got the last one.
-- =========================================================================
create table if not exists public.campaign_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  template_id uuid references public.message_templates(id) on delete set null,
  step_index integer not null,
  delay_hours integer not null default 24,
  variables text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (campaign_id, step_index)
);

create index if not exists campaign_steps_campaign_idx
  on public.campaign_steps(campaign_id, step_index);

alter table public.campaign_steps enable row level security;

drop policy if exists campaign_steps_select on public.campaign_steps;
drop policy if exists campaign_steps_select on public.campaign_steps;
create policy campaign_steps_select on public.campaign_steps
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists campaign_steps_insert on public.campaign_steps;
drop policy if exists campaign_steps_insert on public.campaign_steps;
create policy campaign_steps_insert on public.campaign_steps
  for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists campaign_steps_update on public.campaign_steps;
drop policy if exists campaign_steps_update on public.campaign_steps;
create policy campaign_steps_update on public.campaign_steps
  for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists campaign_steps_delete on public.campaign_steps;
drop policy if exists campaign_steps_delete on public.campaign_steps;
create policy campaign_steps_delete on public.campaign_steps
  for delete to authenticated using (public.is_org_member(org_id));

-- =========================================================================
-- campaign_progress — how far along each campaign is.
--
-- A view rather than counters on the campaign row: counters drift the first
-- time a dispatch run dies between sending and incrementing, and this is
-- read far less often than recipients are written. security_invoker keeps
-- the caller's RLS on campaign_recipients in force, so a member only ever
-- counts their own org's rows.
-- =========================================================================
create or replace view public.campaign_progress
with (security_invoker = on) as
select
  campaign_id,
  org_id,
  count(*)::bigint as total,
  count(*) filter (where status in ('sent', 'delivered', 'read'))::bigint as sent,
  count(*) filter (where status = 'failed')::bigint as failed,
  count(*) filter (where status = 'pending')::bigint as pending
from public.campaign_recipients
group by campaign_id, org_id;

grant select on public.campaign_progress to authenticated;

notify pgrst, 'reload schema';

-- ========================================================================
-- 20260904090000_whatsapp_flows.sql
-- ========================================================================

-- =========================================================================
-- WhatsApp Flows — forms that open inside the chat.
--
-- A flow lives in two places: the editable document here, and the published
-- copy at Meta that customers actually open. They are kept apart on purpose
-- — Meta's copy is immutable once published, so editing has to happen
-- against a local draft that is uploaded as a new version.
-- =========================================================================

create table if not exists public.whatsapp_flows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  -- Meta's id for the flow, once it has been created there. Null while the
  -- form exists only here.
  meta_flow_id text,
  categories text[] not null default '{LEAD_GENERATION}',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'deprecated', 'blocked', 'throttled')),
  -- The editor's own model: screens, each with its components. Built into
  -- Flow JSON on save rather than stored as Flow JSON, so the builder can
  -- reopen a form without parsing its own output back.
  screens jsonb not null default '[]'::jsonb,
  -- What Meta said when it last refused the document, kept so the author
  -- can see it beside the field that caused it.
  validation_errors jsonb not null default '[]'::jsonb,
  preview_url text,
  preview_expires_at timestamptz,
  last_synced_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_flows_org_idx
  on public.whatsapp_flows(org_id, created_at desc);
create unique index if not exists whatsapp_flows_meta_idx
  on public.whatsapp_flows(org_id, meta_flow_id)
  where meta_flow_id is not null;

alter table public.whatsapp_flows enable row level security;

drop policy if exists whatsapp_flows_select on public.whatsapp_flows;
drop policy if exists whatsapp_flows_select on public.whatsapp_flows;
create policy whatsapp_flows_select on public.whatsapp_flows
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists whatsapp_flows_insert on public.whatsapp_flows;
drop policy if exists whatsapp_flows_insert on public.whatsapp_flows;
create policy whatsapp_flows_insert on public.whatsapp_flows
  for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists whatsapp_flows_update on public.whatsapp_flows;
drop policy if exists whatsapp_flows_update on public.whatsapp_flows;
create policy whatsapp_flows_update on public.whatsapp_flows
  for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists whatsapp_flows_delete on public.whatsapp_flows;
drop policy if exists whatsapp_flows_delete on public.whatsapp_flows;
create policy whatsapp_flows_delete on public.whatsapp_flows
  for delete to authenticated using (public.is_org_member(org_id));

-- =========================================================================
-- flow_sends — one row per form handed to one person.
--
-- The flow token is how a submission finds its way back: Meta echoes it
-- verbatim in the reply, and it is the only thing tying an answer to the
-- person who gave it.
-- =========================================================================
create table if not exists public.flow_sends (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  flow_id uuid not null references public.whatsapp_flows(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  wa_id text not null,
  flow_token text not null unique,
  wa_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists flow_sends_flow_idx on public.flow_sends(flow_id, created_at desc);

alter table public.flow_sends enable row level security;

drop policy if exists flow_sends_select on public.flow_sends;
drop policy if exists flow_sends_select on public.flow_sends;
create policy flow_sends_select on public.flow_sends
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists flow_sends_insert on public.flow_sends;
drop policy if exists flow_sends_insert on public.flow_sends;
create policy flow_sends_insert on public.flow_sends
  for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists flow_sends_delete on public.flow_sends;
drop policy if exists flow_sends_delete on public.flow_sends;
create policy flow_sends_delete on public.flow_sends
  for delete to authenticated using (public.is_org_member(org_id));

-- =========================================================================
-- flow_responses — what people actually filled in.
-- =========================================================================
create table if not exists public.flow_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  flow_id uuid references public.whatsapp_flows(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  wa_id text,
  flow_token text,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists flow_responses_flow_idx
  on public.flow_responses(flow_id, created_at desc);
create index if not exists flow_responses_org_idx
  on public.flow_responses(org_id, created_at desc);

alter table public.flow_responses enable row level security;

drop policy if exists flow_responses_select on public.flow_responses;
drop policy if exists flow_responses_select on public.flow_responses;
create policy flow_responses_select on public.flow_responses
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists flow_responses_delete on public.flow_responses;
drop policy if exists flow_responses_delete on public.flow_responses;
create policy flow_responses_delete on public.flow_responses
  for delete to authenticated using (public.is_org_member(org_id));
-- No insert policy for members: responses are written by the webhook with
-- the service role. A member forging a submission would corrupt the record
-- of what a customer actually said.

notify pgrst, 'reload schema';

-- ========================================================================
-- 20260905090000_multi_number.sql
-- ========================================================================

-- =========================================================================
-- More than one WhatsApp number per workspace.
--
-- Every lookup in the app asked for "the org's active connection" and took
-- the single row back. The moment a second number was connected that query
-- returned two rows, maybeSingle() answered with an error instead of a
-- connection, and the app said "connect a WhatsApp number first" to an org
-- that had just connected two. This migration gives a workspace a real set
-- of numbers, with one marked default, and ties each conversation to the
-- number it actually happened on.
-- =========================================================================

alter table public.waba_connections
  -- What Meta calls the number, so screens can show +91 92724 47307 rather
  -- than the 15-digit phone_number_id nobody recognises.
  add column if not exists display_phone_number text,
  add column if not exists verified_name text,
  add column if not exists quality_rating text,
  -- The operator's own name for it: "Support", "Sales", "Test number".
  add column if not exists label text,
  -- Which number is used when nothing more specific applies.
  add column if not exists is_default boolean not null default false,
  add column if not exists last_checked_at timestamptz;

-- One default per workspace. A partial index rather than a constraint so
-- the rule only binds the rows claiming to be default.
drop index if exists public.waba_connections_one_default;
create unique index waba_connections_one_default
  on public.waba_connections(org_id)
  where is_default;

-- Promote the oldest active number in each workspace, so an org that
-- connected numbers before this migration still has a default and nothing
-- has to be chosen by hand before sending works again.
update public.waba_connections w
set is_default = true
where w.id in (
  select distinct on (org_id) id
  from public.waba_connections
  where status = 'active'
  order by org_id, created_at
)
and not exists (
  select 1 from public.waba_connections other
  where other.org_id = w.org_id and other.is_default
);

-- =========================================================================
-- Conversations belong to a number, not just to a workspace.
--
-- Without this a customer who messages two of your numbers lands in one
-- thread, and the reply goes out from whichever number the lookup happened
-- to pick — visibly the wrong sender, to the customer.
-- =========================================================================
alter table public.conversations
  add column if not exists connection_id uuid
    references public.waba_connections(id) on delete set null;

update public.conversations c
set connection_id = (
  select id from public.waba_connections w
  where w.org_id = c.org_id and w.is_default
  limit 1
)
where c.connection_id is null;

create index if not exists conversations_connection_idx
  on public.conversations(connection_id, last_message_at desc);

-- One thread per person per number. NULLS NOT DISTINCT so a pair of rows
-- that both predate a connection still collide rather than duplicating.
alter table public.conversations
  drop constraint if exists conversations_org_id_contact_id_key;
drop index if exists public.conversations_org_contact_connection_key;
create unique index conversations_org_contact_connection_key
  on public.conversations(org_id, contact_id, connection_id)
  nulls not distinct;

-- =========================================================================
-- Automations can be scoped to one number.
--
-- Null means "any number", which is what every existing row wants: a
-- workspace that has only ever had one number should not have to go and
-- attach it to each bot before anything replies again.
-- =========================================================================
alter table public.chatbot_flows
  add column if not exists connection_id uuid
    references public.waba_connections(id) on delete set null;

alter table public.ai_assistants
  add column if not exists connection_id uuid
    references public.waba_connections(id) on delete set null;

alter table public.automation_flows
  add column if not exists connection_id uuid
    references public.waba_connections(id) on delete set null;

alter table public.campaigns
  add column if not exists connection_id uuid
    references public.waba_connections(id) on delete set null;

notify pgrst, 'reload schema';

-- ========================================================================
-- 20260906090000_template_account.sql
-- ========================================================================

-- Templates belong to a WhatsApp Business Account, not to a workspace.
--
-- message_templates was unique on (org_id, name, language), which is only
-- correct while a workspace has one account. With two connected, a template
-- named "marketing_" on each account collapses into a single row: syncing
-- overwrites one account's template with the other's, and the list gives no
-- way to tell which account anything belongs to.

alter table public.message_templates
  add column if not exists waba_id text not null default '';

-- Existing rows were all created against whichever account resolved as the
-- default, so attribute them there rather than leaving them unowned.
update public.message_templates t
set waba_id = c.waba_id
from public.waba_connections c
where t.waba_id = ''
  and c.org_id = t.org_id
  and c.is_default;

update public.message_templates t
set waba_id = c.waba_id
from public.waba_connections c
where t.waba_id = ''
  and c.org_id = t.org_id;

alter table public.message_templates
  drop constraint if exists message_templates_org_id_name_language_key;

-- A plain column index, not an expression: PostgREST's on_conflict can only
-- name real columns, so an expression index here would be unusable from the
-- client and every upsert would fail.
create unique index if not exists message_templates_account_identity_idx
  on public.message_templates(org_id, waba_id, name, language);

create index if not exists message_templates_waba_idx
  on public.message_templates(org_id, waba_id);

notify pgrst, 'reload schema';

-- ========================================================================
-- 20260907090000_site_content.sql
-- ========================================================================

-- =========================================================================
-- Editable landing page
--
-- Every word on the marketing site lived in ten React components, so a price
-- change or a new headline was a code change and a deploy. This holds the
-- content instead.
--
-- Separate from platform_settings on purpose: that table is admin-read-only,
-- and the landing page is served to anonymous visitors. A public SELECT here
-- is deliberate — this is published marketing copy, not configuration.
-- =========================================================================

create table if not exists public.site_content (
  -- One row per section: brand, hero, features, pricing, faq, footer …
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_content enable row level security;

-- Anyone may read: this is the public website.
drop policy if exists site_content_select on public.site_content;
drop policy if exists site_content_select on public.site_content;
create policy site_content_select on public.site_content
  for select to anon, authenticated
  using (true);

-- Only platform staff may write.
drop policy if exists site_content_write on public.site_content;
drop policy if exists site_content_write on public.site_content;
create policy site_content_write on public.site_content
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Brand assets — logo, favicon, OG image — go in their own public bucket
-- rather than the tenant `media` bucket, which is keyed by org id and
-- readable only by that org's members.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand', 'brand', true, 5242880, null)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists brand_objects_select on storage.objects;
drop policy if exists brand_objects_select on storage.objects;
create policy brand_objects_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'brand');

drop policy if exists brand_objects_write on storage.objects;
drop policy if exists brand_objects_write on storage.objects;
create policy brand_objects_write on storage.objects
  for all to authenticated
  using (bucket_id = 'brand' and public.is_platform_admin())
  with check (bucket_id = 'brand' and public.is_platform_admin());

notify pgrst, 'reload schema';

-- ========================================================================
-- 20260908090000_trials_and_pricing.sql
-- ========================================================================

-- =========================================================================
-- Trials, and the real price list
--
-- Two gaps. Signing up gave a workspace and no subscription at all, so every
-- account sat in an undefined billing state until staff assigned a plan by
-- hand — nothing on screen said a trial existed, when it ended, or what to
-- do next. And the seeded catalogue was placeholder pricing with no yearly
-- option.
-- =========================================================================

-- How long a new workspace gets before it has to pay. Kept in settings
-- rather than hardcoded in the trigger so it can be changed without a
-- migration.
insert into public.platform_settings (key, value, description)
values (
  'billing',
  '{"trial_days":14}'::jsonb,
  'Length of the free trial given to a new workspace, in days'
)
on conflict (key) do nothing;

-- =========================================================================
-- Price list. Monthly ₹1,000 / ₹1,500 / ₹2,000, yearly ₹8,000 / ₹10,000 /
-- ₹12,000. price_cents is paise, so ₹1,000 is 100000.
-- =========================================================================
update public.plans set price_cents = 100000, sort_order = 1 where slug = 'starter';
update public.plans set price_cents = 150000, sort_order = 2 where slug = 'growth';
update public.plans set price_cents = 200000, sort_order = 3 where slug = 'scale';

insert into public.plans
  (name, slug, description, price_cents, currency, billing_interval,
   message_limit, contact_limit, seat_limit, features, sort_order)
values
  ('Starter', 'starter-yearly', 'For teams getting started on WhatsApp', 800000, 'INR', 'yearly',
   1000, 500, 2,
   '["1,000 messages/mo","500 contacts","2 team seats","1 WhatsApp number","2 months free"]'::jsonb, 4),
  ('Growth', 'growth-yearly', 'For growing teams running campaigns', 1000000, 'INR', 'yearly',
   10000, 5000, 10,
   '["10,000 messages/mo","5,000 contacts","10 team seats","Campaigns & automations","7 months free"]'::jsonb, 5),
  ('Scale', 'scale-yearly', 'High volume, multiple numbers', 1200000, 'INR', 'yearly',
   100000, 50000, 50,
   '["100,000 messages/mo","50,000 contacts","50 team seats","Priority support","12 months free"]'::jsonb, 6)
on conflict (slug) do nothing;

-- =========================================================================
-- Every workspace starts on a trial.
-- =========================================================================
create or replace function public.trial_days()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    1,
    coalesce((select (value ->> 'trial_days')::integer from public.platform_settings
              where key = 'billing'), 14)
  );
$$;

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
  values (new_org_id, new.id, 'owner');

  insert into public.profiles (user_id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;

  -- The trial. Without a row here the workspace has no billing state at all,
  -- and no screen can tell "hasn't started paying yet" from "lapsed".
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

-- Workspaces that predate this get the same trial, counted from now rather
-- than from signup: nobody should find themselves already expired because a
-- migration ran.
insert into public.subscriptions (org_id, status, current_period_start, current_period_end)
select o.id, 'trialing', now(), now() + make_interval(days => public.trial_days())
from public.organizations o
where not exists (select 1 from public.subscriptions s where s.org_id = o.id)
on conflict (org_id) do nothing;

notify pgrst, 'reload schema';

-- ========================================================================
-- 20260909090000_public_pricing.sql
-- ========================================================================

-- =========================================================================
-- Let the website read the price list
--
-- plans_select was `to authenticated`, so the landing page — served to
-- anonymous visitors — could not read the catalogue at all. It carried its
-- own hardcoded copy instead, which is how the site ended up advertising
-- prices in dollars that no subscription had ever charged.
--
-- Two narrow grants, both read-only and both limited to what is already
-- published on the website.
-- =========================================================================

-- The catalogue, but only what is on sale. A plan taken off sale disappears
-- from the website, which is the whole point of the is_active flag.
drop policy if exists plans_public_select on public.plans;
drop policy if exists plans_public_select on public.plans;
create policy plans_public_select on public.plans
  for select to anon
  using (is_active);

-- The trial length, and nothing else in this table. platform_settings holds
-- configuration, so this is keyed to the one row the pricing section needs
-- rather than opened wholesale.
drop policy if exists platform_settings_public_billing on public.platform_settings;
drop policy if exists platform_settings_public_billing on public.platform_settings;
create policy platform_settings_public_billing on public.platform_settings
  for select to anon
  using (key = 'billing');

notify pgrst, 'reload schema';

-- ========================================================================
-- 20260910090000_crm_sync.sql
-- ========================================================================

-- =========================================================================
-- CRM sync
--
-- The HubSpot, Zoho and Salesforce entries in the catalogue stored
-- credentials and did nothing with them. Now contacts are pushed for real,
-- which needs two things the schema did not have: somewhere to remember
-- which record in the CRM a contact became, and a record of what happened.
--
-- Without the first, every sync creates a duplicate. Without the second, a
-- failed push is invisible — the customer is simply missing from the CRM and
-- nobody finds out until somebody goes looking for them.
-- =========================================================================

alter table public.contacts
  -- {"hubspot":"12345","zoho-crm":"6543..."} — the id this contact has in
  -- each CRM. Keyed by provider slug because a workspace can connect more
  -- than one, and the same person is a different record in each.
  add column if not exists crm_refs jsonb not null default '{}'::jsonb,
  add column if not exists crm_synced_at timestamptz;

-- The bulk sync orders on this, oldest first, so that running it twice
-- carries on rather than starting over.
create index if not exists contacts_crm_synced_idx
  on public.contacts(org_id, crm_synced_at nulls first);

-- =========================================================================
-- crm_sync_log — one row per contact per provider per attempt.
-- =========================================================================
create table if not exists public.crm_sync_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  -- Kept when the contact is deleted: "we pushed this and then lost track of
  -- it" is exactly the case somebody will need the log for.
  contact_id uuid references public.contacts(id) on delete set null,
  status text not null check (status in ('created', 'updated', 'skipped', 'failed')),
  external_id text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists crm_sync_log_org_idx
  on public.crm_sync_log(org_id, created_at desc);
create index if not exists crm_sync_log_failed_idx
  on public.crm_sync_log(org_id, created_at desc)
  where status = 'failed';

alter table public.crm_sync_log enable row level security;

drop policy if exists crm_sync_log_select on public.crm_sync_log;
drop policy if exists crm_sync_log_select on public.crm_sync_log;
create policy crm_sync_log_select on public.crm_sync_log
  for select to authenticated using (public.is_org_member(org_id));

-- Written by the server on the org's behalf, so the insert is a member
-- insert rather than a service-role one: the webhook path runs as the org.
drop policy if exists crm_sync_log_insert on public.crm_sync_log;
drop policy if exists crm_sync_log_insert on public.crm_sync_log;
create policy crm_sync_log_insert on public.crm_sync_log
  for insert to authenticated with check (public.is_org_member(org_id));

drop policy if exists crm_sync_log_delete on public.crm_sync_log;
drop policy if exists crm_sync_log_delete on public.crm_sync_log;
create policy crm_sync_log_delete on public.crm_sync_log
  for delete to authenticated using (public.is_org_member(org_id));

notify pgrst, 'reload schema';

-- ========================================================================
-- 20260911090000_appointments.sql
-- ========================================================================

-- =========================================================================
-- Appointment booking
--
-- Meetings already existed, but only as something a person typed in after
-- the fact. This is the other half: what the business offers, when it is
-- free, and a booking conversation the customer can complete on WhatsApp
-- without anyone on the business's side touching it.
--
-- Four new tables. Availability is a weekly pattern rather than a list of
-- slots — storing every slot would mean generating them ahead of time,
-- regenerating them whenever the hours changed, and still being wrong the
-- moment somebody booked one.
-- =========================================================================

-- =========================================================================
-- appointment_types — what can be booked.
--
-- "Multiple options" in the customer's list: a clinic offers consultation
-- and follow-up, a salon offers a dozen services at different lengths.
-- Length lives here rather than in settings because that is the whole point
-- of having more than one.
-- =========================================================================
create table if not exists public.appointment_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null default 30
    check (duration_minutes between 5 and 1440),
  -- Smallest currency unit, as everywhere else. Zero means it is not priced
  -- on the menu, which is different from being free.
  price_cents integer not null default 0 check (price_cents >= 0),
  location text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointment_types_org_idx
  on public.appointment_types(org_id, sort_order);

alter table public.appointment_types enable row level security;

drop policy if exists appointment_types_select on public.appointment_types;
drop policy if exists appointment_types_select on public.appointment_types;
create policy appointment_types_select on public.appointment_types
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists appointment_types_insert on public.appointment_types;
drop policy if exists appointment_types_insert on public.appointment_types;
create policy appointment_types_insert on public.appointment_types
  for insert to authenticated with check (public.is_org_member(org_id));
drop policy if exists appointment_types_update on public.appointment_types;
drop policy if exists appointment_types_update on public.appointment_types;
create policy appointment_types_update on public.appointment_types
  for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
drop policy if exists appointment_types_delete on public.appointment_types;
drop policy if exists appointment_types_delete on public.appointment_types;
create policy appointment_types_delete on public.appointment_types
  for delete to authenticated using (public.is_org_member(org_id));

-- =========================================================================
-- appointment_settings — when the business is open, and what the bot says.
--
-- One row per workspace. `hours` is a weekly pattern keyed by weekday, each
-- day holding any number of windows, so a business that shuts for lunch is
-- expressed rather than approximated:
--
--   {"mon":[{"start":"09:00","end":"13:00"},{"start":"14:00","end":"18:00"}]}
-- =========================================================================
create table if not exists public.appointment_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  is_enabled boolean not null default false,
  -- IANA name. Opening hours are meaningless without it, and a business
  -- booking customers in another country needs its own, not the server's.
  timezone text not null default 'Asia/Kolkata',
  slot_minutes integer not null default 30 check (slot_minutes between 5 and 480),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),
  -- Nothing is offered sooner than this. Without it the bot cheerfully
  -- offers a 9:00 appointment at 8:59.
  min_notice_minutes integer not null default 60
    check (min_notice_minutes between 0 and 20160),
  horizon_days integer not null default 14 check (horizon_days between 1 and 120),
  max_per_slot integer not null default 1 check (max_per_slot between 1 and 100),
  hours jsonb not null default '{
    "sun": [],
    "mon": [{"start":"09:00","end":"18:00"}],
    "tue": [{"start":"09:00","end":"18:00"}],
    "wed": [{"start":"09:00","end":"18:00"}],
    "thu": [{"start":"09:00","end":"18:00"}],
    "fri": [{"start":"09:00","end":"18:00"}],
    "sat": [{"start":"09:00","end":"14:00"}]
  }'::jsonb,
  -- What a customer types to start booking. Matched as a whole word, so
  -- "book" does not fire on "bookkeeping".
  trigger_keywords text[] not null default
    array['book', 'booking', 'appointment', 'appointments', 'schedule', 'slot'],
  location text,
  greeting text not null default 'Happy to book you in. What would you like to book?',
  confirmation text not null default
    'Booked. See you on {{date}} at {{time}}. Reply CANCEL if you need to change it.',
  no_slots_message text not null default
    'Sorry, there is nothing free in the next couple of weeks. Reply here and someone will sort it out with you.',
  cancelled_message text not null default 'No problem — nothing has been booked.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointment_settings enable row level security;

drop policy if exists appointment_settings_select on public.appointment_settings;
drop policy if exists appointment_settings_select on public.appointment_settings;
create policy appointment_settings_select on public.appointment_settings
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists appointment_settings_write on public.appointment_settings;
drop policy if exists appointment_settings_write on public.appointment_settings;
create policy appointment_settings_write on public.appointment_settings
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- =========================================================================
-- appointment_blackouts — a holiday, a day off, an afternoon out.
--
-- Separate from the weekly pattern because it is an exception to it, and
-- editing next Tuesday's hours to close for one Tuesday would close every
-- Tuesday after it too.
-- =========================================================================
create table if not exists public.appointment_blackouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists appointment_blackouts_org_idx
  on public.appointment_blackouts(org_id, starts_at);

alter table public.appointment_blackouts enable row level security;

drop policy if exists appointment_blackouts_select on public.appointment_blackouts;
drop policy if exists appointment_blackouts_select on public.appointment_blackouts;
create policy appointment_blackouts_select on public.appointment_blackouts
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists appointment_blackouts_write on public.appointment_blackouts;
drop policy if exists appointment_blackouts_write on public.appointment_blackouts;
create policy appointment_blackouts_write on public.appointment_blackouts
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- =========================================================================
-- booking_sessions — where a customer is in the booking conversation.
--
-- One per conversation. It cannot live in conversations.bot_variables: a
-- graph flow owns that, and a customer who starts booking halfway through a
-- flow would have their flow state overwritten by ours.
--
-- Expires, because a customer who is asked "which day?" and never answers
-- must not have their next unrelated message read as a date.
-- =========================================================================
create table if not exists public.booking_sessions (
  conversation_id uuid primary key
    references public.conversations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  step text not null check (step in ('type', 'date', 'time')),
  appointment_type_id uuid references public.appointment_types(id) on delete set null,
  -- "2026-09-11" as the business reads it, not as UTC does.
  chosen_date text,
  expires_at timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_sessions_expiry_idx
  on public.booking_sessions(expires_at);

alter table public.booking_sessions enable row level security;

drop policy if exists booking_sessions_select on public.booking_sessions;
drop policy if exists booking_sessions_select on public.booking_sessions;
create policy booking_sessions_select on public.booking_sessions
  for select to authenticated using (public.is_org_member(org_id));
drop policy if exists booking_sessions_write on public.booking_sessions;
drop policy if exists booking_sessions_write on public.booking_sessions;
create policy booking_sessions_write on public.booking_sessions
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- =========================================================================
-- meetings gains what a booking needs.
-- =========================================================================
alter table public.meetings
  add column if not exists appointment_type_id uuid
    references public.appointment_types(id) on delete set null,
  -- 'whatsapp' means the customer booked it themselves. Worth knowing: those
  -- are the ones nobody on the business's side has seen yet.
  add column if not exists source text not null default 'manual',
  add column if not exists reminder_sent_at timestamptz;

alter table public.meetings drop constraint if exists meetings_source_check;
alter table public.meetings add constraint meetings_source_check
  check (source in ('manual', 'whatsapp', 'api'));

-- Counting what is already taken at a given time is the query the slot
-- generator runs for every request, so it wants an index that answers it.
create index if not exists meetings_org_scheduled_idx
  on public.meetings(org_id, starts_at)
  where status = 'scheduled';

-- =========================================================================
-- A booking is a bot outcome like any other, and the Automations log has to
-- be able to say so.
-- =========================================================================
alter table public.bot_runs drop constraint if exists bot_runs_matched_kind_check;
alter table public.bot_runs add constraint bot_runs_matched_kind_check
  check (matched_kind in
    ('flow_step', 'chatbot', 'faq', 'automation', 'assistant', 'handoff', 'booking', 'none'));

notify pgrst, 'reload schema';

-- ========================================================================
-- 20260912090000_appointment_reminders.sql
-- ========================================================================

-- =========================================================================
-- Appointment reminders, and where a booking went in the calendar
--
-- meetings.reminder_sent_at existed and nothing ever wrote to it. This adds
-- the settings a reminder needs and the column that records where the
-- booking ended up outside this system.
-- =========================================================================

alter table public.appointment_settings
  -- How long before the appointment to remind the customer. 0 turns it off.
  add column if not exists reminder_hours integer not null default 3
    check (reminder_hours between 0 and 168),
  -- A reminder usually falls outside WhatsApp's 24-hour service window, and
  -- outside it Meta accepts nothing but an approved template. Free-form is
  -- attempted only when this is blank, and then only when the window is
  -- genuinely open — otherwise the reminder is recorded as skipped rather
  -- than failing silently.
  add column if not exists reminder_template text,
  add column if not exists reminder_template_language text not null default 'en',
  add column if not exists reminder_message text not null default
    'Reminder: your appointment is at {{time}} today. Reply here if you need to change it.';

alter table public.meetings
  -- The event id in whatever calendar this was pushed to, so a second push
  -- updates the event rather than creating a duplicate.
  add column if not exists calendar_event_id text,
  add column if not exists calendar_synced_at timestamptz,
  add column if not exists calendar_error text;

-- The reminder sweep scans on exactly this.
create index if not exists meetings_reminder_due_idx
  on public.meetings(starts_at)
  where status = 'scheduled' and reminder_sent_at is null;

notify pgrst, 'reload schema';
