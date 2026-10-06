import { createAdminClient } from "@/lib/supabase/admin";
import { saveWalletRates } from "../actions";
import ActionForm, { Field, SelectField } from "@/components/ui/ActionForm";
import { Card } from "@/components/ui/primitives";
import { CATEGORIES, SUGGESTED_RATES, formatRate, readRates, walletInUse } from "@/lib/wallet";

/**
 * What a message costs the workspace that sends it.
 *
 * These are this business's own prices, not Meta's. Meta bills the
 * WhatsApp account directly, in its own currency, on its own schedule —
 * nothing here tries to guess that number, because a figure invented here
 * that disagrees with the real invoice is worse than no figure at all.
 *
 * All four at zero switches the wallet off entirely: no charges, no
 * balance on anybody's screen, no statement. That is the default, so a
 * deployment that never configures this never shows a customer a wallet
 * it does not use.
 */
export default async function WalletRates() {
  const admin = createAdminClient();

  const { data: setting } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "wallet_rates")
    .maybeSingle();

  const rates = readRates(setting?.value);

  return (
    <Card className="mb-6">
      <h2 className="font-semibold mb-1">Message pricing</h2>
      <p className="text-sm text-white/50 mb-5 leading-relaxed">
        What each template message takes off a workspace&rsquo;s wallet, in the smallest unit of
        the currency — <span className="text-white/75">85 means ₹0.85</span>. Leave everything at
        zero and the wallet is switched off: no charges, no balance, no statement on anybody&rsquo;s
        screen.
      </p>

      {!walletInUse(rates) && (
        <p className="text-sm text-[#FACC15]/85 mb-4 leading-relaxed">
          The wallet is currently off — customers see nothing about it, and nothing is charged.
          The boxes below are filled in with a starting point, so pressing Save switches it on.
          They are a suggestion and nothing more: set them against your own Meta invoice.
        </p>
      )}

      <ActionForm action={saveWalletRates} submitLabel="Save pricing">
        <Field
          label="Currency"
          name="currency"
          defaultValue={rates.currency}
          hint="An ISO code such as INR or USD. Balances already added are not converted."
        />

        {CATEGORIES.map((category) => {
          const current =
            category.key === "marketing"
              ? rates.marketing
              : category.key === "utility"
                ? rates.utility
                : category.key === "authentication"
                  ? rates.authentication
                  : rates.service;

          // The suggestion only fills an unconfigured form. Once a price is
          // set, that price is what the box shows — a form that silently
          // reverts somebody's number to a default is one they stop
          // trusting after the first time it does it.
          const shown = walletInUse(rates) ? current : SUGGESTED_RATES[category.key];

          return (
            <Field
              key={category.key}
              label={`${category.label} — per message`}
              name={category.key}
              type="number"
              defaultValue={String(shown)}
              hint={`${category.hint} ${
                shown > 0 ? `That is ${formatRate(shown, rates.currency)} a message.` : "Free."
              }`}
            />
          );
        })}

        <Field
          label="Warn below"
          name="low_balance"
          type="number"
          defaultValue={String(rates.lowBalance)}
          hint="The dashboard starts saying the balance is low under this. 10000 is ₹100."
        />

        <SelectField
          label="Stop sending when the wallet is empty?"
          name="block_when_empty"
          defaultValue={rates.blockWhenEmpty ? "on" : "off"}
          options={[
            { value: "off", label: "No — keep sending and let the balance go negative" },
            { value: "on", label: "Yes — pause sending until it is topped up" },
          ]}
        />

        <p className="text-xs text-white/40 leading-relaxed">
          &ldquo;No&rdquo; is the safer default and the one to leave alone unless you mean it. A
          wallet that stops sending the moment a rate is mistyped is every customer&rsquo;s
          campaign stopping at once, and the first you hear of it is the support queue.
        </p>
      </ActionForm>
    </Card>
  );
}
