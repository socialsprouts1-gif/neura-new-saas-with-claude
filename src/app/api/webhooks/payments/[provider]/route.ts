import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loadIntegration } from "@/lib/integration-store";
import { isPaymentProvider, type PaymentProvider } from "@/lib/provider-meta";
import { loadPaymentSettings, updateOrderStatus } from "@/lib/commerce";
import { fillTemplate } from "@/lib/booking-dialogue";
import { formatAmount } from "@/lib/orders";
import { loadOrgConnection } from "@/lib/whatsapp-send";
import { dispatchWebhookEvent } from "@/lib/outgoing-webhooks";

// Where a gateway tells us a payment landed.
//
// The order is found by the reference we put on the payment link, so no
// lookup table is needed — but that reference travels through the customer's
// browser, so the signature is what makes this trustworthy. An unsigned
// notification is refused rather than believed: without that, anyone who
// learns an order reference can mark it paid.
//
// One route per provider, keyed on the path, because each signs differently
// and each names its "it worked" event something else.

export const dynamic = "force-dynamic";

/** Which event on each gateway means the money actually arrived. */
const PAID_EVENTS: Record<PaymentProvider, string[]> = {
  razorpay: ["payment_link.paid", "payment.captured", "order.paid"],
  cashfree: ["PAYMENT_SUCCESS_WEBHOOK", "LINK_PAID"],
  stripe: ["checkout.session.completed", "payment_intent.succeeded"],
};

const FAILED_EVENTS: Record<PaymentProvider, string[]> = {
  razorpay: ["payment.failed", "payment_link.expired", "payment_link.cancelled"],
  cashfree: ["PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"],
  stripe: ["payment_intent.payment_failed", "checkout.session.expired"],
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { provider } = await params;
  if (!isPaymentProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  // The raw body, not the parsed one: every signature here is over the exact
  // bytes, and JSON.stringify of a parsed object is not those bytes.
  const raw = await request.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body is not JSON" }, { status: 400 });
  }

  const reference = findReference(provider, payload);
  if (!reference) {
    // Nothing to match. Answered 200 so the gateway stops retrying a
    // notification we will never be able to place.
    return NextResponse.json({ ok: true, note: "No order reference in this event" });
  }

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("store_orders")
    .select("id, org_id, reference, status, currency, total_cents, conversation_id")
    .eq("reference", reference)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ ok: true, note: "No such order" });
  }

  // The secret is the tenant's, so it can only be checked once the order —
  // and through it the workspace — is known.
  const stored = await loadIntegration(supabase, order.org_id, provider);
  const secret = stored?.values.webhook_secret ?? process.env[envKeyFor(provider)] ?? "";

  const verdict = verify(provider, request, raw, secret);
  if (verdict !== "ok") {
    console.error(`Refused a ${provider} webhook for ${reference}: ${verdict}`);
    // 401 rather than 200: the gateway should retry, and a real
    // misconfiguration should show up in its own delivery log.
    return NextResponse.json({ error: verdict }, { status: 401 });
  }

  const event = eventNameOf(provider, payload, request);
  const paid = PAID_EVENTS[provider].some((name) => event.includes(name));
  const failed = FAILED_EVENTS[provider].some((name) => event.includes(name));

  if (!paid && !failed) {
    return NextResponse.json({ ok: true, note: `Ignoring ${event}` });
  }

  // Already settled. Gateways redeliver, and marking an order paid twice
  // would send the customer a second thank-you.
  if (paid && (order.status === "paid" || order.status === "confirmed")) {
    return NextResponse.json({ ok: true, note: "Already paid" });
  }

  if (failed) {
    await supabase
      .from("store_orders")
      .update({ payment_status: event, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return NextResponse.json({ ok: true, note: "Recorded a failed attempt" });
  }

  const settings = await loadPaymentSettings(supabase, order.org_id);
  const connection = await loadOrgConnection(supabase, order.org_id, {
    conversationId: order.conversation_id,
  });

  await supabase
    .from("store_orders")
    .update({ payment_status: event, updated_at: new Date().toISOString() })
    .eq("id", order.id);

  await updateOrderStatus({
    supabase,
    orgId: order.org_id,
    orderId: order.id,
    status: "paid",
    notify: connection
      ? {
          connection,
          body: fillTemplate(settings.payment_received_message, {
            reference: order.reference,
            total: formatAmount(order.total_cents, order.currency),
          }),
        }
      : null,
  });

  await dispatchWebhookEvent(supabase, order.org_id, "order.paid", {
    reference: order.reference,
    total_cents: order.total_cents,
    currency: order.currency,
    provider,
  });

  return NextResponse.json({ ok: true });
}

/** The env var holding a shared fallback secret for this gateway. */
function envKeyFor(provider: PaymentProvider): string {
  return {
    razorpay: "RAZORPAY_WEBHOOK_SECRET",
    cashfree: "CASHFREE_WEBHOOK_SECRET",
    stripe: "STRIPE_WEBHOOK_SECRET",
  }[provider];
}

/**
 * Checks the signature.
 *
 * Returns "ok" or the reason it was refused. A missing secret is a refusal
 * rather than a pass: a route that accepts unsigned notifications is a route
 * anyone who learns an order reference can use to mark it paid.
 */
function verify(
  provider: PaymentProvider,
  request: NextRequest,
  raw: string,
  secret: string
): "ok" | string {
  if (!secret) {
    return "No webhook secret is configured for this workspace, so the notification cannot be trusted. Add it as `webhook_secret` on the integration.";
  }

  if (provider === "razorpay") {
    const signature = request.headers.get("x-razorpay-signature");
    if (!signature) return "No x-razorpay-signature header";
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    return same(signature, expected) ? "ok" : "Signature did not match";
  }

  if (provider === "cashfree") {
    // Cashfree signs the timestamp concatenated with the body, base64 over
    // sha256 — not the body alone, which is the mistake that makes every
    // delivery look forged.
    const signature = request.headers.get("x-webhook-signature");
    const timestamp = request.headers.get("x-webhook-timestamp");
    if (!signature || !timestamp) return "No Cashfree signature headers";
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}${raw}`)
      .digest("base64");
    return same(signature, expected) ? "ok" : "Signature did not match";
  }

  // Stripe: t=timestamp,v1=signature over "timestamp.body".
  const header = request.headers.get("stripe-signature");
  if (!header) return "No stripe-signature header";

  const parts = new Map(
    header.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key.trim(), rest.join("=").trim()] as const;
    })
  );
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return "Malformed stripe-signature header";

  // Five minutes, as Stripe recommends: without it a captured notification
  // can be replayed forever.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return "Signature timestamp is too old";

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  return same(signature, expected) ? "ok" : "Signature did not match";
}

/** Constant-time compare, so a wrong signature leaks nothing by timing. */
function same(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Our order reference, wherever this gateway chose to put it back. */
function findReference(
  provider: PaymentProvider,
  payload: Record<string, unknown>
): string | null {
  const read = (path: string): string | null => {
    let current: unknown = payload;
    for (const key of path.split(".")) {
      if (!current || typeof current !== "object") return null;
      current = (current as Record<string, unknown>)[key];
    }
    return typeof current === "string" && current.trim() ? current.trim() : null;
  };

  if (provider === "razorpay") {
    return (
      read("payload.payment_link.entity.reference_id") ??
      read("payload.payment.entity.notes.reference") ??
      read("payload.order.entity.receipt")
    );
  }

  if (provider === "cashfree") {
    return read("data.link.link_id") ?? read("data.order.order_id") ?? read("data.link_id");
  }

  return (
    read("data.object.metadata.reference") ??
    read("data.object.client_reference_id")
  );
}

/** What this gateway calls the event. */
function eventNameOf(
  provider: PaymentProvider,
  payload: Record<string, unknown>,
  request: NextRequest
): string {
  if (provider === "cashfree") {
    return (
      (typeof payload.type === "string" ? payload.type : "") ||
      request.headers.get("x-webhook-event") ||
      ""
    );
  }
  return typeof payload.event === "string" ? payload.event : String(payload.type ?? "");
}
