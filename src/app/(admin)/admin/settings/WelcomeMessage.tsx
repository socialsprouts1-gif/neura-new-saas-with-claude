import { createAdminClient } from "@/lib/supabase/admin";
import { saveWelcomeMessage } from "../actions";
import ActionForm, { Field, SelectField } from "@/components/ui/ActionForm";
import { Card } from "@/components/ui/primitives";
import { readWelcome, welcomeProblem } from "@/lib/signup-welcome";
import { displayWaNumber } from "@/lib/whatsapp-link";

/**
 * The WhatsApp message every new sign-up gets.
 *
 * A person who signs up for a WhatsApp automation product and hears
 * nothing on WhatsApp has been shown the product not working, on the one
 * day they were most willing to be impressed.
 *
 * It must be an approved template. A brand-new contact has never written
 * in, so WhatsApp's 24-hour service window is shut and Meta refuses
 * anything else — which is why this asks for a template name rather than
 * a box to type a message into.
 */
export default async function WelcomeMessage() {
  const admin = createAdminClient();

  const [{ data: setting }, { data: connections }] = await Promise.all([
    admin.from("platform_settings").select("value").eq("key", "platform_whatsapp").maybeSingle(),
    admin
      .from("waba_connections")
      .select("id, org_id, display_phone_number, verified_name, label, status")
      .eq("status", "active")
      .limit(50),
  ]);

  const welcome = readWelcome(setting?.value);

  const orgIds = [...new Set((connections ?? []).map((row) => row.org_id))];
  const { data: orgs } = orgIds.length
    ? await admin.from("organizations").select("id, name").in("id", orgIds)
    : { data: [] };
  const orgName = new Map((orgs ?? []).map((row) => [row.id, row.name]));

  // The number carries its workspace, so a mismatched pair cannot be
  // chosen at all.
  const senders = (connections ?? []).map((row) => ({
    value: `${row.org_id}|${row.id}`,
    label: `${orgName.get(row.org_id) ?? "Workspace"} — ${
      row.display_phone_number ? displayWaNumber(row.display_phone_number) : "number pending"
    }${row.label ? ` (${row.label})` : ""}`,
  }));

  const current = welcome.orgId ? `${welcome.orgId}|${welcome.connectionId}` : "";
  const problem = welcomeProblem(welcome);

  return (
    <Card className="mb-6">
      <h2 className="font-semibold mb-1">WhatsApp welcome message</h2>
      <p className="text-sm text-white/50 mb-5 leading-relaxed">
        Sent to the number somebody gives when they sign up, from one of your own WhatsApp
        numbers. It has to be an <span className="text-white/75">approved template</span> —
        a new sign-up has never messaged you, so the 24-hour window is shut and Meta refuses
        free-form text to them.
      </p>

      {senders.length === 0 ? (
        <p className="text-sm text-[#FACC15]/80 leading-relaxed">
          No active WhatsApp number is connected on any workspace yet. Connect one under
          Integrations first — there is nothing to send from.
        </p>
      ) : (
        <>
          {problem && (
            <p className="text-sm text-[#FACC15]/80 mb-4 leading-relaxed">{problem}</p>
          )}
          <ActionForm action={saveWelcomeMessage} submitLabel="Save">
            <SelectField
              label="Send it"
              name="enabled"
              defaultValue={welcome.enabled ? "on" : "off"}
              options={[
                { value: "off", label: "No — do not message new sign-ups" },
                { value: "on", label: "Yes — welcome every new sign-up" },
              ]}
            />
            <SelectField
              label="From which number"
              name="sender"
              defaultValue={current}
              options={senders}
            />
            <Field
              label="Template name"
              name="template_name"
              defaultValue={welcome.templateName}
              placeholder="welcome_to_neurachat"
              hint="Exactly as it appears in WhatsApp Manager — lowercase, underscores, no spaces."
            />
            <Field
              label="Template language"
              name="language"
              defaultValue={welcome.language}
              placeholder="en"
              hint="The language code on the approved template, such as en or en_US."
            />
            <SelectField
              label="Does the template greet them by name?"
              name="uses_name"
              defaultValue={welcome.usesName ? "on" : "off"}
              options={[
                { value: "off", label: "No — it has no variables" },
                { value: "on", label: "Yes — it takes their name as {{1}}" },
              ]}
            />
          </ActionForm>
        </>
      )}
    </Card>
  );
}
