# Neura Chat

Multi-tenant WhatsApp automation SaaS. Next.js 16 (App Router) + Supabase
(Postgres, Auth, RLS) + the Meta WhatsApp Cloud API used directly — no BSP
in the middle, each tenant connects their own WhatsApp Business Account.

## Setup

### 1. Database

Open the Supabase SQL editor, paste the whole of `supabase/setup.sql`, and
run it. It is generated from `supabase/migrations/*.sql` and is safe to run
more than once — re-running it after adding a migration applies only what is
missing.

```bash
node scripts/build-setup-sql.mjs   # regenerate after editing a migration
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` for local development, and add the
same values in Vercel → Settings → Environment Variables for production.
`NEXT_PUBLIC_*` values are baked in at build time, so changing one needs a
redeploy, not just a restart.

| Variable | Required | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | The publishable (or legacy anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | The secret (or legacy service_role) key. Bypasses RLS — server only |
| `META_APP_SECRET` | yes | Meta App → Basic Settings. Verifies the webhook signature |
| `TOKEN_ENCRYPTION_KEY` | yes | `openssl rand -base64 32`. Encrypts stored WABA tokens |
| `ANTHROPIC_API_KEY` | only for the AI Assistant | console.anthropic.com |

Everything except the AI Assistant works without `ANTHROPIC_API_KEY`.

### 3. Connect a WhatsApp number

In the app: **Settings → WhatsApp connection**. Then register the webhook on
Meta's side — Settings shows both values Meta asks for (the callback URL and
the per-connection verify token) and the `messages` field to subscribe to.
Until that is done, no inbound message reaches the app.

## How an inbound message is handled

`POST /api/webhooks/whatsapp` verifies `X-Hub-Signature-256` against
`META_APP_SECRET`, answers `200` immediately, then does the work in `after()`:

1. upsert the contact and conversation, store the message
2. fire `contact.created` / `message.received` to the org's outgoing webhooks
3. run the bot pipeline (`src/lib/message-runner.ts`)

The pipeline picks one reply, in this order — rules the business wrote beat
generated answers:

| # | Source | Beats |
|---|---|---|
| 1 | Handoff keyword → pauses the bot, flags the chat | everything |
| 2 | The next step of a flow already in progress | |
| 3 | Keyword / menu chatbot | FAQ, automations, AI |
| 4 | Welcome bot (first message only) | |
| 5 | FAQ bot (keyword + question-overlap scoring) | automations, AI |
| 6 | Keyword automation | AI |
| 7 | AI assistant (Claude) | the fallback bot |
| 8 | Fallback bot | — |

Every evaluation, match or not, writes a row to `bot_runs`, visible at
**Automations → Bot activity** and in the inbox thread header. A webhook
redelivery of the same message hits a unique index there and is dropped, so
Meta's retries cannot double-reply.

Agents can pause and resume the bot per conversation from the inbox.

## Development

```bash
npm run dev     # dev server
npm test        # matcher unit tests (node:test)
npm run build   # production build
npx tsc --noEmit
```

`src/lib/reply-matcher.ts` is deliberately pure — no Supabase, fetch or env
access — so the priority order and keyword-boundary rules can be tested
directly. `src/lib/message-runner.ts` holds everything that touches I/O.
