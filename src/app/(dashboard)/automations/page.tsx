import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { createAutomation, toggleAutomation } from "../actions";
import ActionForm, { Field, SelectField, TextareaField } from "@/components/ui/ActionForm";
import { PageHeader, Card, Badge, Table, Td, EmptyState } from "@/components/ui/primitives";

const TRIGGER_LABELS: Record<string, string> = {
  keyword: "Keyword match",
  first_message: "First message",
  no_reply: "No reply",
};

export default async function AutomationsPage() {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const { data: flows, error } = await supabase
    .from("automation_flows")
    .select("id, name, trigger_type, trigger_config, actions_json, is_active, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Automations"
        subtitle="Reply automatically when an inbound message matches a trigger."
      />

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="order-2 lg:order-1">
          {error ? (
            <EmptyState
              title="Couldn't load automations"
              description={`${error.message}. If this mentions a missing relation, the database migrations haven't been applied yet.`}
            />
          ) : flows && flows.length > 0 ? (
            <Table head={["Name", "Trigger", "Reply", "State", ""]}>
              {flows.map((f) => {
                const cfg = f.trigger_config as { keyword?: string };
                const actions = f.actions_json as Array<{ type: string; body?: string }>;
                return (
                  <tr key={f.id} className="hover:bg-white/3 transition-colors">
                    <Td className="font-medium">{f.name}</Td>
                    <Td>
                      <div className="text-xs text-white/60">
                        {TRIGGER_LABELS[f.trigger_type] ?? f.trigger_type}
                      </div>
                      {cfg?.keyword && <Badge tone="purple">{cfg.keyword}</Badge>}
                    </Td>
                    <Td className="text-xs text-white/50 max-w-xs truncate">
                      {actions?.[0]?.body ?? <span className="text-white/30">—</span>}
                    </Td>
                    <Td>
                      <Badge tone={f.is_active ? "green" : "grey"}>
                        {f.is_active ? "active" : "paused"}
                      </Badge>
                    </Td>
                    <Td>
                      <ActionForm
                        action={toggleAutomation}
                        submitLabel={f.is_active ? "Pause" : "Activate"}
                        compact
                      >
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="is_active" value={String(f.is_active)} />
                      </ActionForm>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <EmptyState
              title="No automations yet"
              description="Create a keyword automation to reply instantly when someone messages a specific word."
            />
          )}

          <p className="text-xs text-white/35 mt-4">
            Automations are stored and can be activated here. The webhook does not yet
            evaluate them against inbound messages, so they will not fire until that
            runner is built.
          </p>
        </div>

        <Card className="order-1 lg:order-2">
          <h2 className="font-semibold mb-1">New automation</h2>
          <p className="text-sm text-white/50 mb-5">Start with a keyword auto-reply.</p>
          <ActionForm action={createAutomation} submitLabel="Create automation" resetOnSuccess>
            <div className="space-y-4">
              <Field label="Name" name="name" required placeholder="Pricing auto-reply" />
              <SelectField
                label="Trigger"
                name="trigger_type"
                defaultValue="keyword"
                options={[
                  { value: "keyword", label: "Keyword match" },
                  { value: "first_message", label: "First message" },
                  { value: "no_reply", label: "No reply" },
                ]}
              />
              <Field label="Keyword" name="keyword" placeholder="price" />
              <TextareaField
                label="Reply message"
                name="reply"
                rows={3}
                placeholder="Thanks for reaching out! Our plans start at ₹999/month."
              />
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
