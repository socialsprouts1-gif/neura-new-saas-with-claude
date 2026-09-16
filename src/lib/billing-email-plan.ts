// Which billing email a workspace is owed, and when.
//
// Two things make this worth being pure and tested. The first is that a
// duplicate is not a cosmetic bug: the same "your trial ends tomorrow"
// arriving three days running is the fastest way to teach a customer to
// filter everything this product sends. The second is that these fire on
// a schedule nobody watches, so a wrong boundary is discovered by a
// customer being nagged after they paid, not by anyone here.
//
// The dedupe key carries the period the message is about. That is what
// makes a monthly plan get exactly one renewal notice per month without
// anything having to remember how many have been sent.

// Relative with the extension: the test runner strips types but does not
// resolve the "@/" alias, and billingState is a value import.
import { billingState, type SubscriptionRow } from "./billing-state.ts";

export type BillingEmailKind =
  /** The trial is nearly over. */
  | "trial_ending"
  /** It is over and nothing was bought. */
  | "trial_expired"
  /** A paid plan renews in a few days. */
  | "renewal_reminder"
  /** A paid plan's period ended without a renewal landing. */
  | "subscription_expired";

export interface DueEmail {
  kind: BillingEmailKind;
  /** Unique per workspace per period, so a resend is refused by the index. */
  dedupeKey: string;
  /** Whole days until the period ends. Negative once it has passed. */
  daysLeft: number;
  planName: string | null;
}

/** How early to warn. Three days is enough to act and not so early it is forgotten. */
export const NOTICE_DAYS = 3;

export function dueBillingEmail(
  orgId: string,
  subscription: SubscriptionRow | null | undefined,
  now: Date = new Date()
): DueEmail | null {
  const state = billingState(subscription, now);
  const periodEnd = subscription?.current_period_end;

  // Without a period end there is no date to write and no key to dedupe
  // on, so any send would repeat on every sweep.
  if (!periodEnd || state.daysLeft === null) return null;

  const key = (kind: BillingEmailKind) => `${orgId}:${kind}:${periodEnd}`;
  const found = (kind: BillingEmailKind): DueEmail => ({
    kind,
    dedupeKey: key(kind),
    daysLeft: state.daysLeft!,
    planName: state.planName,
  });

  switch (state.stage) {
    case "trialing":
      // Only inside the window. Warning on day one of seven is nagging,
      // and it would also burn the one send this period is allowed.
      return state.daysLeft <= NOTICE_DAYS ? found("trial_ending") : null;

    case "trial_expired":
      return found("trial_expired");

    case "active":
      return state.daysLeft <= NOTICE_DAYS && state.daysLeft >= 0
        ? found("renewal_reminder")
        : null;

    case "past_due":
      return found("subscription_expired");

    // A workspace with no billing row at all is not owed anything; saying
    // "your plan has lapsed" to someone who never had one is worse than
    // silence.
    case "none":
    default:
      return null;
  }
}
