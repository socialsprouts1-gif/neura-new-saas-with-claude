import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SiteEvent } from "@/lib/analytics";
import { MICROS } from "@/lib/wallet";

// Everything the analytics screen reads, in one place.
//
// The shape of all of this is governed by one constraint: PostgREST cannot
// group. So anything that needs a count per workspace is fetched once as a
// flat list and grouped here, rather than asked for per workspace — twenty
// workspaces at six queries each is a hundred and twenty round trips for a
// page somebody opens to glance at.
//
// Every fetch is capped. A cap that is hit is reported on the screen
// rather than silently truncating the numbers, because a dashboard that
// quietly under-counts is worse than one that says it cannot see
// everything. If a deployment ever outgrows these, the answer is a nightly
// rollup table, not a bigger number here.

const EVENT_CAP = 20_000;
const MESSAGE_CAP = 50_000;

export interface Window {
  days: number;
  since: string;
}

export function windowOf(days: number): Window {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  return { days, since: since.toISOString() };
}

export interface SiteSide {
  events: SiteEvent[];
  /** True when the cap was hit, so the screen can say so. */
  capped: boolean;
  /** Null when the table does not exist yet. */
  available: boolean;
}

export async function loadSiteEvents(window: Window): Promise<SiteSide> {
  const { data, error } = await createAdminClient()
    .from("site_events")
    .select("visitor_id, session_id, event, path, label, referrer_host, source, medium, campaign, device, created_at")
    .gte("created_at", window.since)
    .order("created_at", { ascending: false })
    .limit(EVENT_CAP);

  if (error) return { events: [], capped: false, available: false };
  return {
    events: (data ?? []) as SiteEvent[],
    capped: (data ?? []).length >= EVENT_CAP,
    available: true,
  };
}

export interface WorkspaceRow {
  id: string;
  name: string;
  createdAt: string;
  status: string;
  planName: string | null;
  suspended: boolean;
  numbers: number;
  bots: number;
  assistants: number;
  /** Outbound messages inside the window. */
  sent: number;
  received: number;
  /** Spent from the wallet, in micros, over all time. */
  spentMicros: number;
  balanceMicros: number;
}

export interface Business {
  workspaces: WorkspaceRow[];
  created: number;
  trialing: number;
  paying: number;
  pastDue: number;
  suspended: number;
  /** Paid orders inside the window, in minor units. */
  revenueCents: number;
  revenueCurrency: string;
  templatesSent: number;
  walletSpentMicros: number;
  walletToppedUpMicros: number;
  messagesCapped: boolean;
}

export async function loadBusiness(window: Window): Promise<Business> {
  const admin = createAdminClient();

  const [orgs, subs, numbers, bots, assistants, messages, ledger, orders] = await Promise.all([
    admin.from("organizations").select("id, name, created_at, suspended_at, wallet_balance_micros"),
    admin.from("subscriptions").select("org_id, status, plans(name)"),
    admin.from("waba_connections").select("org_id, status"),
    admin.from("chatbot_flows").select("org_id, is_active"),
    admin.from("ai_assistants").select("org_id, is_active"),
    admin
      .from("messages")
      .select("org_id, direction")
      .gte("created_at", window.since)
      .limit(MESSAGE_CAP),
    admin.from("wallet_ledger").select("org_id, kind, amount_micros"),
    admin
      .from("orders")
      .select("amount_cents, currency, status, created_at")
      .gte("created_at", window.since),
  ]);

  const count = <T extends { org_id: string }>(
    rows: T[] | null,
    keep: (row: T) => boolean = () => true
  ): Map<string, number> => {
    const out = new Map<string, number>();
    for (const row of rows ?? []) {
      if (!keep(row)) continue;
      out.set(row.org_id, (out.get(row.org_id) ?? 0) + 1);
    }
    return out;
  };

  const numbersBy = count(numbers.data, (row) => row.status === "active");
  const botsBy = count(bots.data);
  const assistantsBy = count(assistants.data);
  const sentBy = count(messages.data, (row) => row.direction === "outbound");
  const receivedBy = count(messages.data, (row) => row.direction === "inbound");

  const subBy = new Map(
    (subs.data ?? []).map((row) => [
      row.org_id,
      {
        status: row.status,
        planName: (row.plans as { name: string } | null)?.name ?? null,
      },
    ])
  );

  // A debit is money spent; a top-up is money in. Both are stored signed,
  // so the sum of the negatives is the spend.
  const spentBy = new Map<string, number>();
  let walletSpentMicros = 0;
  let walletToppedUpMicros = 0;
  for (const row of ledger.data ?? []) {
    const amount = Number(row.amount_micros ?? 0);
    if (amount < 0) {
      spentBy.set(row.org_id, (spentBy.get(row.org_id) ?? 0) + -amount);
      walletSpentMicros += -amount;
    } else {
      walletToppedUpMicros += amount;
    }
  }

  const workspaces: WorkspaceRow[] = (orgs.data ?? []).map((org) => {
    const sub = subBy.get(org.id);
    return {
      id: org.id,
      name: org.name,
      createdAt: org.created_at,
      status: sub?.status ?? "none",
      planName: sub?.planName ?? null,
      suspended: Boolean(org.suspended_at),
      numbers: numbersBy.get(org.id) ?? 0,
      bots: botsBy.get(org.id) ?? 0,
      assistants: assistantsBy.get(org.id) ?? 0,
      sent: sentBy.get(org.id) ?? 0,
      received: receivedBy.get(org.id) ?? 0,
      spentMicros: spentBy.get(org.id) ?? 0,
      balanceMicros: Number(org.wallet_balance_micros ?? 0),
    };
  });

  // Busiest first: the screen's job is to show who is actually using it.
  workspaces.sort((a, b) => b.sent + b.received - (a.sent + a.received));

  const paid = (orders.data ?? []).filter((row) => row.status === "paid");

  return {
    workspaces,
    created: workspaces.filter((row) => row.createdAt >= window.since).length,
    trialing: workspaces.filter((row) => row.status === "trialing").length,
    paying: workspaces.filter((row) => row.status === "active").length,
    pastDue: workspaces.filter((row) => row.status === "past_due").length,
    suspended: workspaces.filter((row) => row.suspended).length,
    revenueCents: paid.reduce((sum, row) => sum + (row.amount_cents ?? 0), 0),
    revenueCurrency: paid[0]?.currency ?? "INR",
    // Every wallet debit is one template that went out, which is the
    // closest thing to a true count — the ledger is written per send.
    templatesSent: (ledger.data ?? []).filter((row) => Number(row.amount_micros ?? 0) < 0).length,
    walletSpentMicros,
    walletToppedUpMicros,
    messagesCapped: (messages.data ?? []).length >= MESSAGE_CAP,
  };
}

/** Micros to a plain rupee string, for a tile. */
export function money(micros: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(micros / MICROS);
}
