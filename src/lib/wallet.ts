// The message wallet: what a send costs, and what the balance means.
//
// Pure by design: no fetch, no env, no server-only, so it can be tested.
//
// The prices in here are this business's own, set in Admin. They are not
// Meta's rates and nothing here tries to guess them — Meta bills the
// WhatsApp account directly, in its own currency, on its own schedule, and
// a number invented here that disagrees with the real invoice is worse
// than no number at all. What this counts is what this platform charges
// its own customers for a message it sends on their behalf.
//
// Everything is in the smallest unit of the currency, like the rest of the
// billing code. Paise, not rupees: a rate of ₹0.85 is 85, and holding it
// as 0.85 is how three thousand messages end up costing ₹2,549.9999994.

export type MessageCategory = "marketing" | "utility" | "authentication" | "service";

export const CATEGORIES: Array<{
  key: MessageCategory;
  label: string;
  hint: string;
}> = [
  {
    key: "marketing",
    label: "Marketing",
    hint: "Promotions and anything the customer did not ask for. The dearest, at Meta and usually here.",
  },
  {
    key: "utility",
    label: "Utility",
    hint: "About something they already did — an order, a booking, an account.",
  },
  {
    key: "authentication",
    label: "Authentication",
    hint: "One-time codes.",
  },
  {
    key: "service",
    label: "Service",
    hint: "A reply inside the 24-hour window. Free at Meta since 2026, so usually free here too.",
  },
];

export function isCategory(value: unknown): value is MessageCategory {
  return CATEGORIES.some((category) => category.key === value);
}

export interface WalletRates {
  currency: string;
  /** Per message, in the smallest unit. */
  marketing: number;
  utility: number;
  authentication: number;
  service: number;
  /**
   * Whether sending stops when the balance runs out.
   *
   * Off by default, and deliberately so. A wallet that silently stops a
   * customer's campaign the moment somebody mistypes a rate is worse than
   * one that goes briefly negative and says so on the screen.
   */
  blockWhenEmpty: boolean;
  /** Below this, the dashboard starts saying so. */
  lowBalance: number;
}

/**
 * A starting point for the pricing form, not a price list.
 *
 * Offered as placeholders so switching the wallet on is one Save rather
 * than four guesses about what a message is worth. They are this file's
 * opinion and nothing else — not Meta's rates, which are billed to the
 * WhatsApp account separately and change by country and by year. Whoever
 * sets these should be looking at their own Meta invoice.
 */
export const SUGGESTED_RATES = {
  marketing: 110,
  utility: 50,
  authentication: 40,
  service: 0,
} as const;

export const DEFAULT_RATES: WalletRates = {
  currency: "INR",
  marketing: 0,
  utility: 0,
  authentication: 0,
  service: 0,
  blockWhenEmpty: false,
  lowBalance: 10000,
};

function money(value: unknown, fallback = 0): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return fallback;
  return Math.round(amount);
}

export function readRates(value: unknown): WalletRates {
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    currency: (typeof raw.currency === "string" && raw.currency.trim()) || DEFAULT_RATES.currency,
    marketing: money(raw.marketing),
    utility: money(raw.utility),
    authentication: money(raw.authentication),
    service: money(raw.service),
    // Only ever literally true. A half-configured wallet that starts
    // refusing sends is a support ticket from every customer at once.
    blockWhenEmpty: raw.block_when_empty === true,
    lowBalance: money(raw.low_balance, DEFAULT_RATES.lowBalance),
  };
}

export function writeRates(rates: WalletRates): Record<string, unknown> {
  return {
    currency: rates.currency,
    marketing: money(rates.marketing),
    utility: money(rates.utility),
    authentication: money(rates.authentication),
    service: money(rates.service),
    block_when_empty: rates.blockWhenEmpty,
    low_balance: money(rates.lowBalance, DEFAULT_RATES.lowBalance),
  };
}

/**
 * What one message of this category costs.
 *
 * An unknown category costs the utility rate rather than nothing. Charging
 * zero for something unrecognised is the error that only shows up on the
 * month's invoice, by which time the messages are long gone.
 */
export function costOf(category: string, rates: WalletRates): number {
  const key = String(category ?? "").toLowerCase();
  if (key === "marketing") return rates.marketing;
  if (key === "authentication") return rates.authentication;
  if (key === "service") return rates.service;
  return rates.utility;
}

/** Whether the wallet is switched on at all. All rates zero means it is not. */
export function walletInUse(rates: WalletRates): boolean {
  return rates.marketing > 0 || rates.utility > 0 || rates.authentication > 0 || rates.service > 0;
}

// --- what the balance means ------------------------------------------------

export type BalanceState = "healthy" | "low" | "empty" | "negative" | "off";

export function balanceState(balanceCents: number, rates: WalletRates): BalanceState {
  if (!walletInUse(rates)) return "off";
  if (balanceCents < 0) return "negative";
  if (balanceCents === 0) return "empty";
  if (balanceCents <= rates.lowBalance) return "low";
  return "healthy";
}

/** Whether a send of this cost may go ahead. */
export function canSpend(balanceCents: number, cost: number, rates: WalletRates): boolean {
  if (!rates.blockWhenEmpty) return true;
  if (cost <= 0) return true;
  return balanceCents - cost >= 0;
}

/**
 * Roughly how many more messages the balance buys.
 *
 * At the dearest rate that is actually set, because a number worked out at
 * the cheapest one is the number that runs out two days early. Null when
 * nothing is priced, which is not an estimate of infinity — it is the
 * absence of a price.
 */
export function messagesLeft(balanceCents: number, rates: WalletRates): number | null {
  const rate = Math.max(rates.marketing, rates.utility, rates.authentication);
  if (rate <= 0) return null;
  return Math.max(0, Math.floor(balanceCents / rate));
}

// --- saying it in money ----------------------------------------------------

/** "₹1,250.00" from 125000, in the currency the wallet is kept in. */
export function formatMoney(cents: number, currency = "INR"): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unknown currency code must not take the page down with it.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * A per-message rate, which needs more decimals than a total does.
 *
 * ₹0.85 a message is the difference between a usable price list and one
 * that reads "₹1" for every row.
 */
export function formatRate(cents: number, currency = "INR"): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** The top-up amounts offered as buttons, in the smallest unit. */
export const TOPUP_PRESETS = [50000, 100000, 250000, 500000] as const;

export const MIN_TOPUP = 10000;
export const MAX_TOPUP = 50000000;

export type TopupCheck = { ok: true; cents: number } | { ok: false; error: string };

/**
 * Whether this is an amount somebody can actually add.
 *
 * A floor because a gateway charges more to process ₹10 than ₹10 is worth,
 * and a ceiling because a mistyped amount with four extra zeros on it is a
 * refund request and a very bad afternoon.
 */
export function checkTopup(cents: unknown, currency = "INR"): TopupCheck {
  const amount = Number(cents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter how much to add." };
  }
  const rounded = Math.round(amount);
  if (rounded < MIN_TOPUP) {
    return { ok: false, error: `The smallest top-up is ${formatMoney(MIN_TOPUP, currency)}.` };
  }
  if (rounded > MAX_TOPUP) {
    return { ok: false, error: `The largest top-up is ${formatMoney(MAX_TOPUP, currency)}.` };
  }
  return { ok: true, cents: rounded };
}

// --- the statement ---------------------------------------------------------

export type LedgerKind = "topup" | "debit" | "refund" | "adjustment";

export interface LedgerRow {
  kind: LedgerKind;
  amountCents: number;
  balanceAfterCents: number;
  description: string;
  createdAt: string;
}

/** Whether this line added to the balance or took from it. */
export function isCredit(kind: LedgerKind): boolean {
  return kind === "topup" || kind === "refund";
}

/** "+₹5,000.00" or "−₹0.85", so a statement scans without reading the words. */
export function signedAmount(row: Pick<LedgerRow, "kind" | "amountCents">, currency = "INR"): string {
  const sign = isCredit(row.kind) ? "+" : "−";
  return `${sign}${formatMoney(row.amountCents, currency)}`;
}

export const LEDGER_LABELS: Record<LedgerKind, string> = {
  topup: "Added",
  debit: "Message sent",
  refund: "Refunded",
  adjustment: "Adjustment",
};

/**
 * What a statement adds up to over a period.
 *
 * Spent and added kept apart rather than netted. "You added ₹5,000 and
 * spent ₹4,096" is a sentence somebody can check against their own
 * records; a single net figure of ₹904 is one they cannot.
 */
export function summarise(rows: LedgerRow[]): {
  added: number;
  spent: number;
  messages: number;
} {
  let added = 0;
  let spent = 0;
  let messages = 0;

  for (const row of rows) {
    if (isCredit(row.kind)) added += row.amountCents;
    else spent += row.amountCents;
    if (row.kind === "debit") messages += 1;
  }

  return { added, spent, messages };
}
