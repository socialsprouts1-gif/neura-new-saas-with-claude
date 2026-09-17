import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/types/admin";
import { dueBillingEmail, type BillingEmailKind } from "@/lib/billing-email-plan";
import { emailBrand, sendEmail } from "@/lib/email";
import {
  renewalReminderEmail,
  subscriptionExpiredEmail,
  trialEndingEmail,
  trialExpiredEmail,
  trialFollowUpEmail,
  type EmailBody,
  type EmailBrand,
} from "@/lib/email-templates";

// The nightly sweep that sends trial and renewal mail.
//
// It reads every workspace's subscription and asks the pure planner what,
// if anything, each is owed. Nothing here decides timing or wording — that
// is all in billing-email-plan and email-templates, where it can be tested
// without a database and without the risk of a test sending real mail.
//
// Who gets it: the owner. A workspace can have several members and the
// bill is one person's problem; copying an admin who cannot pay is noise,
// and copying everybody is how a product ends up in a filter.

export interface SweepResult {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
}

function bodyFor(
  kind: BillingEmailKind,
  brand: EmailBrand,
  input: {
    planName: string | null;
    daysLeft: number;
    renewsOn: string;
    step: number;
    fromPrice: string | null;
  }
): EmailBody {
  switch (kind) {
    case "trial_ending":
      return trialEndingEmail(brand, { daysLeft: input.daysLeft });
    case "trial_expired":
      return trialExpiredEmail(brand, { fromPrice: input.fromPrice });
    case "trial_followup":
      return trialFollowUpEmail(brand, {
        step: input.step,
        daysSince: -input.daysLeft,
        fromPrice: input.fromPrice,
      });
    case "renewal_reminder":
      return renewalReminderEmail(brand, {
        planName: input.planName ?? "Your plan",
        daysLeft: input.daysLeft,
        renewsOn: input.renewsOn,
      });
    case "subscription_expired":
      return subscriptionExpiredEmail(brand, { planName: input.planName });
  }
}

/**
 * The cheapest plan on offer, as a sentence fragment.
 *
 * Read once for the whole sweep rather than per workspace: it is the same
 * answer every time, and a query per customer for a number that does not
 * change is how a nightly job becomes a slow one.
 */
async function cheapestPlan(
  admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
  const { data } = await admin
    .from("plans")
    .select("price_cents, currency, billing_interval")
    .eq("is_active", true)
    .eq("billing_interval", "monthly")
    .order("price_cents", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data || typeof data.price_cents !== "number") return null;
  return `${formatMoney(data.price_cents, data.currency)} a month`;
}

/** Human date for a sentence: "16 October 2026". */
function longDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export async function sweepBillingEmails(now: Date = new Date()): Promise<SweepResult> {
  const admin = createAdminClient();
  const brand = emailBrand();
  const result: SweepResult = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  const fromPrice = await cheapestPlan(admin);

  const { data: subscriptions, error } = await admin
    .from("subscriptions")
    .select("org_id, status, current_period_end, plans(name)")
    // Only states that can owe a message. A cancelled workspace has
    // already said no and should not be chased.
    .in("status", ["trialing", "active", "past_due"]);

  if (error || !subscriptions) {
    console.error("Could not read subscriptions for billing email", error);
    return result;
  }

  for (const row of subscriptions) {
    result.checked += 1;

    const due = dueBillingEmail(
      row.org_id,
      {
        status: row.status,
        current_period_end: row.current_period_end,
        plans: row.plans as { name: string } | null,
      },
      now
    );
    if (!due) continue;

    const to = await ownerEmail(admin, row.org_id);
    if (!to) {
      result.skipped += 1;
      continue;
    }

    const outcome = await sendEmail({
      to,
      orgId: row.org_id,
      kind: due.kind,
      dedupeKey: due.dedupeKey,
      body: bodyFor(due.kind, brand, {
        planName: due.planName,
        daysLeft: due.daysLeft,
        renewsOn: longDate(row.current_period_end ?? ""),
        step: due.step ?? 0,
        fromPrice,
      }),
    });

    if (outcome.skipped) result.skipped += 1;
    else if (outcome.ok) result.sent += 1;
    else result.failed += 1;
  }

  return result;
}

/**
 * The address to write to.
 *
 * The owner, and only the owner. Falls back to nothing rather than to an
 * admin: a bill sent to somebody who cannot pay it is worse than one that
 * did not arrive, because it looks like it was handled.
 */
export async function ownerEmail(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string
): Promise<string | null> {
  const { data } = await admin
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (!data?.user_id) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("user_id", data.user_id)
    .maybeSingle();

  return profile?.email?.trim() || null;
}
