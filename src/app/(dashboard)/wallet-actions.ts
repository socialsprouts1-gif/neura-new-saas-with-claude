"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrg } from "@/lib/org";
import { loadIntegration } from "@/lib/integration-store";
import { createRazorpayOrder } from "@/lib/payment-links";
import { isPaymentProvider } from "@/lib/provider-meta";
import { checkTopup, formatMoney } from "@/lib/wallet";

const PLATFORM_ORG_SETTING = "platform_payment_org";

// Adding money to the message wallet.
//
// The order is created here and the money is taken by Razorpay's own
// modal. Nothing in this file moves a balance: a top-up becomes real in
// the verify route, after a signature proves the payment happened, and
// never because a browser said it did.

export interface TopupOrder {
  ok: boolean;
  error?: string;
  orderId?: string;
  keyId?: string;
  amountPaise?: number;
  currency?: string;
}

export async function startTopup(amountCents: number): Promise<TopupOrder> {
  const { orgId } = await requireOrg();

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("wallet_currency, name")
    .eq("id", orgId)
    .maybeSingle();

  const currency = org?.wallet_currency || "INR";

  const check = checkTopup(amountCents, currency);
  if (!check.ok) return { ok: false, error: check.error };

  // The platform's own gateway, not the workspace's. A top-up is money
  // paid to this business, so it is taken on this business's account —
  // the tenant's own Razorpay keys are for charging their own customers.
  const admin = createAdminClient();
  const gateway = await platformGateway(admin);
  if (!gateway.ok) return { ok: false, error: gateway.error };

  if (gateway.provider !== "razorpay") {
    return {
      ok: false,
      error: "Topping up needs Razorpay. Get in touch and we will add the balance for you.",
    };
  }

  const stored = await loadIntegration(admin, gateway.orgId, gateway.provider);
  if (!stored) {
    return {
      ok: false,
      error: "Card payments are not finished being set up. Get in touch and we will add the balance for you.",
    };
  }

  // Recorded pending before the modal opens, so a payment that arrives can
  // always be matched to a workspace even if the browser never comes back.
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      org_id: orgId,
      kind: "wallet_topup",
      amount_cents: check.cents,
      currency,
      status: "pending",
      provider: gateway.provider,
      description: `Wallet top-up — ${formatMoney(check.cents, currency)}`,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { ok: false, error: orderError?.message ?? "The top-up could not be started." };
  }

  const created = await createRazorpayOrder(
    { provider: "razorpay", credentials: stored.values, config: stored.config ?? {} },
    {
      amountPaise: check.cents,
      currency,
      receipt: `wallet-${order.id.slice(0, 20)}`,
      // What the verify route matches on, so a payment can only ever be
      // credited to the workspace that asked for it.
      notes: { kind: "wallet_topup", order_id: order.id, org_id: orgId },
    }
  );

  if (!created.ok) {
    await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
    return { ok: false, error: created.error };
  }

  await admin
    .from("orders")
    .update({ provider_reference: created.id })
    .eq("id", order.id);

  return {
    ok: true,
    orderId: created.id,
    keyId: created.keyId,
    amountPaise: check.cents,
    currency,
  };
}

async function platformGateway(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ ok: true; orgId: string; provider: string } | { ok: false; error: string }> {
  const { data: setting } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", PLATFORM_ORG_SETTING)
    .maybeSingle();

  const value = setting?.value as { org_id?: string; provider?: string } | null;
  const orgId = value?.org_id?.trim();
  const provider = value?.provider?.trim();

  if (!orgId || !provider || !isPaymentProvider(provider)) {
    return {
      ok: false,
      error: "Card payments are not set up on this deployment yet. Get in touch and we will add the balance for you.",
    };
  }

  return { ok: true, orgId, provider };
}
