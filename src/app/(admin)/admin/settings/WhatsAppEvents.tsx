import { createAdminClient } from "@/lib/supabase/admin";
import { saveWhatsAppEvents } from "../actions";
import ActionForm, { SelectField } from "@/components/ui/ActionForm";
import { Card } from "@/components/ui/primitives";
import { EVENTS, readEvents } from "@/lib/whatsapp-events";
import { displayWaNumber } from "@/lib/whatsapp-link";

/**
 * The WhatsApp messages the platform sends its own customers.
 *
 * Templates are chosen from a list, not typed. A name typed by hand is a
 * 404 from Meta that names nothing — and the list has to carry the
 * language too, because the same template name exists once per language
 * and sending the wrong one fails exactly the same way.
 *
 * The list is what Meta has actually approved on the chosen number, so a
 * template that is still in review cannot be picked and then silently
 * fail for every customer.
 */
export default async function WhatsAppEvents() {
  const admin = createAdminClient();

  const [{ data: setting }, { data: connections }] = await Promise.all([
    admin.from("platform_settings").select("value").eq("key", "platform_whatsapp").maybeSingle(),
    admin
      .from("waba_connections")
      .select("id, org_id, waba_id, display_phone_number, label, status")
      .eq("status", "active")
      .limit(50),
  ]);

  const settings = readEvents(setting?.value);

  const orgIds = [...new Set((connections ?? []).map((row) => row.org_id))];
  const { data: orgs } = orgIds.length
    ? await admin.from("organizations").select("id, name").in("id", orgIds)
    : { data: [] };
  const orgName = new Map((orgs ?? []).map((row) => [row.id, row.name]));

  const senders = (connections ?? []).map((row) => ({
    value: `${row.org_id}|${row.id}`,
    wabaId: row.waba_id,
    label: `${orgName.get(row.org_id) ?? "Workspace"} — ${
      row.display_phone_number ? displayWaNumber(row.display_phone_number) : "number pending"
    }${row.label ? ` (${row.label})` : ""}`,
  }));

  const current = settings.orgId ? `${settings.orgId}|${settings.connectionId}` : "";

  // Approved templates on the chosen number. Scoped to its WhatsApp
  // account, because a template belongs to the account rather than to the
  // workspace, and offering one from a different account is a 404.
  const chosen = senders.find((sender) => sender.value === current) ?? senders[0];
  const { data: templates } = chosen?.wabaId
    ? await admin
        .from("message_templates")
        .select("name, language, body_text, components_json")
        .eq("waba_id", chosen.wabaId)
        .eq("status", "approved")
        .order("name")
    : { data: [] };

  const templateOptions = (templates ?? []).map((row) => ({
    value: `${row.name}|${row.language}`,
    label: `${row.name} · ${row.language}`,
  }));

  return (
    <Card className="mb-6">
      <h2 className="font-semibold mb-1">WhatsApp messages to your customers</h2>
      <p className="text-sm text-white/50 mb-5 leading-relaxed">
        Sent from one of your own WhatsApp numbers to the number somebody gave when they signed
        up. Each one has to be an <span className="text-white/75">approved template</span> — these
        reach people who have never messaged you, so the 24-hour window is shut and Meta refuses
        free-form text.
      </p>

      {senders.length === 0 ? (
        <p className="text-sm text-[#FACC15]/80 leading-relaxed">
          No active WhatsApp number is connected on any workspace yet. Connect one under
          Integrations first — there is nothing to send from.
        </p>
      ) : (
        <ActionForm action={saveWhatsAppEvents} submitLabel="Save">
          <SelectField
            label="Send everything from"
            name="sender"
            defaultValue={current}
            options={senders.map(({ value, label }) => ({ value, label }))}
          />

          {templateOptions.length === 0 && (
            <p className="text-sm text-[#FACC15]/80 leading-relaxed">
              That number has no approved templates yet. Create one in WhatsApp Manager, press
              Sync on the Templates screen, then come back — there is nothing to choose from
              until Meta has approved it.
            </p>
          )}

          {EVENTS.map((event) => {
            const message = settings.messages[event.key];
            const chosenTemplate = message.templateName
              ? `${message.templateName}|${message.language}`
              : "";

            return (
              <div
                key={event.key}
                className="rounded-2xl border border-white/10 bg-white/3 p-4 space-y-3"
              >
                <div>
                  <h3 className="text-sm font-semibold">{event.label}</h3>
                  <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{event.when}</p>
                </div>

                <SelectField
                  label="Send this one?"
                  name={`${event.key}_enabled`}
                  defaultValue={message.enabled ? "on" : "off"}
                  options={[
                    { value: "off", label: "No" },
                    { value: "on", label: "Yes" },
                  ]}
                />

                <SelectField
                  label="Template"
                  name={`${event.key}_template`}
                  defaultValue={chosenTemplate}
                  options={[
                    { value: "", label: templateOptions.length ? "— choose a template —" : "— none approved yet —" },
                    // A template configured earlier that is no longer in
                    // the approved list still shows, so saving another
                    // event does not silently blank it.
                    ...(chosenTemplate && !templateOptions.some((o) => o.value === chosenTemplate)
                      ? [{ value: chosenTemplate, label: `${message.templateName} · ${message.language} (not approved)` }]
                      : []),
                    ...templateOptions,
                  ]}
                />

                <SelectField
                  label="Does it greet them by name?"
                  name={`${event.key}_uses_name`}
                  defaultValue={message.usesName ? "on" : "off"}
                  options={[
                    { value: "off", label: "No — it has no variables" },
                    { value: "on", label: "Yes — it takes their name as {{1}}" },
                  ]}
                />
              </div>
            );
          })}
        </ActionForm>
      )}
    </Card>
  );
}
