// Razorpay Standard Checkout: the arithmetic and the signature.
//
// Pure by design: no fetch, no env, no server-only, so it can be tested.
// The secret is passed in rather than read here, which is what lets a test
// exercise the real algorithm without a real key existing anywhere.
//
// Standard Checkout differs from the payment links this product already
// sends: the customer stays on the page and pays in a modal, and what
// comes back is three fields the browser hands over. Those fields are
// signed, and the signature is the only thing that makes them worth
// anything — a browser can say whatever it likes.

import { createHmac, timingSafeEqual } from "node:crypto";

/** Razorpay refuses anything under one rupee. */
export const MIN_PAISE = 100;

export interface CheckoutFields {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Paise from the amount this codebase stores.
 *
 * `amount_cents` is the minor unit of whatever currency the row is in, and
 * for INR the minor unit is the paisa — so this is a rename rather than a
 * conversion. It exists to say that out loud, because "cents" in a rupee
 * amount is the kind of thing somebody later multiplies by a hundred.
 */
export function toPaise(amountCents: number): number {
  return Math.round(amountCents);
}

export type AmountCheck = { ok: true; paise: number } | { ok: false; error: string };

export function checkAmount(amountCents: number): AmountCheck {
  if (!Number.isFinite(amountCents)) {
    return { ok: false, error: "That amount is not a number." };
  }

  const paise = toPaise(amountCents);
  if (paise < MIN_PAISE) {
    return {
      ok: false,
      error: `Razorpay will not take less than ${MIN_PAISE} paise (₹1). This came to ${paise}.`,
    };
  }

  return { ok: true, paise };
}

/**
 * What Razorpay signs: the order id and the payment id, joined by a pipe.
 *
 * The order matters and the separator matters. Signing the two ids
 * concatenated without it would let a different pair of ids produce the
 * same string.
 */
export function checkoutSignature(orderId: string, paymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

/**
 * Whether these three fields really came from Razorpay.
 *
 * Compared in constant time. A comparison that returns early on the first
 * wrong character leaks, one guess at a time, what the right one is.
 */
export function verifyCheckoutSignature(fields: CheckoutFields, secret: string): boolean {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId } = fields;
  const signature = fields.razorpay_signature;

  if (!orderId || !paymentId || !signature || !secret) return false;

  const expected = checkoutSignature(orderId, paymentId, secret);
  // Equal length is a precondition of timingSafeEqual, and a length
  // mismatch is already a failure — so answering early is safe here.
  if (expected.length !== signature.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(signature, "utf8"));
  } catch {
    return false;
  }
}

/** Whether a body carries all three fields, before anything is verified. */
export function readCheckoutFields(body: unknown): CheckoutFields | null {
  const source = body as Partial<CheckoutFields> | null;
  const orderId = source?.razorpay_order_id;
  const paymentId = source?.razorpay_payment_id;
  const signature = source?.razorpay_signature;

  if (typeof orderId !== "string" || !orderId.trim()) return null;
  if (typeof paymentId !== "string" || !paymentId.trim()) return null;
  if (typeof signature !== "string" || !signature.trim()) return null;

  return {
    razorpay_order_id: orderId.trim(),
    razorpay_payment_id: paymentId.trim(),
    razorpay_signature: signature.trim(),
  };
}
