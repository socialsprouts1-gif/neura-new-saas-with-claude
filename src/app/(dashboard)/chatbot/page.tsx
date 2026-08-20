import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { saveChatbotFlow, toggleChatbotFlow, deleteChatbotFlow } from "../portal-actions";
import ActionForm, { Field, SelectField, TextareaField } from "@/components/ui/ActionForm";
import { PageHeader, Card, StatCard, Badge, EmptyState } from "@/components/ui/primitives";
import type { ChatbotNode } from "@/types/portal";

const TRIGGER_LABEL: Record<string, string> = {
  keyword: "Keyword",
  welcome: "First message",
  fallback: "No match",
  menu: "Menu",
  business_hours: "Outside hours",
};

// A trigger's meaning is not obvious from its name alone, and picking the
// wrong one is the most common way a bot silently never fires.
const TRIGGER_HELP: Record<string, string> = {
  keyword: "Fires when an inbound message contains this exact word.",
  welcome: "Fires on the very first message from a new contact.",
  fallback: "Fires when nothing else matched — your safety net.",
  menu: "Fires when someone asks for the menu or options.",
  business_hours: "Fires when a message arrives outside your working hours.",
};

export default async function ChatbotPage() {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const { data: flows, error } = await supabase
    .from("chatbot_flows")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const all = flows ?? [];
  const active = all.filter((f) => f.is_active).length;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Chatbot"
        subtitle="Reply automatically to inbound WhatsApp messages, with quick-reply buttons."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Bots" value={all.length} />
        <StatCard label="Active" value={active} />
        <StatCard label="Paused" value={all.length - active} />
        <StatCard label="Triggers used" value={new Set(all.map((f) => f.trigger_type)).size} />
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="order-2 lg:order-1 space-y-4">
          {error ? (
            <EmptyState
              title="Couldn't load bots"
              description={`${error.message}. If this mentions a missing relation, the portal migration hasn't been applied yet.`}
            />
          ) : all.length > 0 ? (
            all.map((flow) => {
              const nodes = (flow.nodes ?? []) as ChatbotNode[];
              const first = nodes[0];
              return (
                <Card key={flow.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{flow.name}</h3>
                        <Badge tone={flow.is_active ? "green" : "grey"}>
                          {flow.is_active ? "active" : "paused"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <Badge tone="purple">{TRIGGER_LABEL[flow.trigger_type]}</Badge>
                        {flow.trigger_value && (
                          <code className="text-[#00D4FF]">{flow.trigger_value}</code>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <ActionForm
                        action={toggleChatbotFlow}
                        submitLabel={flow.is_active ? "Pause" : "Activate"}
                        compact
                      >
                        <input type="hidden" name="id" value={flow.id} />
                        <input type="hidden" name="is_active" value={String(flow.is_active)} />
                      </ActionForm>
                      <ActionForm action={deleteChatbotFlow} submitLabel="Delete" compact>
                        <input type="hidden" name="id" value={flow.id} />
                      </ActionForm>
                    </div>
                  </div>

                  {/* Conversation preview — shows what the customer actually sees. */}
                  {first && (
                    <div className="bg-[#0A0A0F] border border-white/8 rounded-xl p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">
                        Preview
                      </div>
                      <div className="flex justify-start mb-2">
                        <div className="max-w-[80%] bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5">
                          <p className="text-sm whitespace-pre-wrap">{first.body}</p>
                        </div>
                      </div>
                      {first.buttons && first.buttons.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {first.buttons.map((b) => (
                            <span
                              key={b}
                              className="px-3 py-1.5 rounded-lg border border-[#00D4FF]/30 bg-[#00D4FF]/8 text-[#00D4FF] text-xs font-medium"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-white/25 mt-3">
                        {nodes.length} node{nodes.length === 1 ? "" : "s"} · v{flow.version}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })
          ) : (
            <EmptyState
              title="No bots yet"
              description="Create your first bot to answer common questions instantly, day or night."
            />
          )}

          <p className="text-xs text-white/35">
            Bots are stored and can be activated here. The webhook does not yet evaluate them
            against inbound messages, so an active bot will not reply until that runner is built.
          </p>
        </div>

        <Card className="order-1 lg:order-2">
          <h2 className="font-semibold mb-1">New bot</h2>
          <p className="text-sm text-white/50 mb-5">
            Start with a single reply. You can add buttons for quick choices.
          </p>

          <ActionForm action={saveChatbotFlow} submitLabel="Create bot" resetOnSuccess>
            <div className="space-y-4">
              <Field label="Bot name" name="name" required placeholder="Pricing enquiry" />
              <SelectField
                label="Trigger"
                name="trigger_type"
                defaultValue="keyword"
                options={Object.entries(TRIGGER_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <Field
                label="Keyword"
                name="trigger_value"
                placeholder="price"
                hint="Only used by the Keyword trigger"
              />
              <TextareaField
                label="Reply message"
                name="reply"
                rows={4}
                placeholder="Thanks for reaching out! Our plans start at ₹999/month. What would you like to know?"
              />
              <Field
                label="Quick reply buttons"
                name="buttons"
                placeholder="See plans, Talk to sales"
                hint="Comma separated, max 3 — WhatsApp's limit"
              />
            </div>
          </ActionForm>

          <div className="mt-6 pt-5 border-t border-white/8">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">
              How triggers work
            </div>
            <dl className="space-y-2">
              {Object.entries(TRIGGER_HELP).map(([key, help]) => (
                <div key={key}>
                  <dt className="text-xs font-medium text-white/70">{TRIGGER_LABEL[key]}</dt>
                  <dd className="text-[11px] text-white/40 leading-relaxed">{help}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Card>
      </div>
    </div>
  );
}
