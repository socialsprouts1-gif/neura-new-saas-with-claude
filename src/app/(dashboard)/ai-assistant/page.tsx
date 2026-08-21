import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { saveAiAssistant, deleteAiAssistant } from "../portal-actions";
import ActionForm, { Field, SelectField, TextareaField } from "@/components/ui/ActionForm";
import { PageHeader, Card, Badge, Table, Td, EmptyState } from "@/components/ui/primitives";
import { ASSISTANT_MODELS } from "@/types/portal";
import { formatDate } from "@/types/admin";
import { isAssistantConfigured } from "@/lib/ai-assistant";

export default async function AiAssistantPage() {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const { data: assistants, error } = await supabase
    .from("ai_assistants")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  // A configured assistant with no API key behind it looks identical to a
  // working one until a customer messages and gets silence. Say so here.
  const hasApiKey = isAssistantConfigured();

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="AI Assistants"
        subtitle="Give each assistant a role and a model, and it answers in your brand's voice."
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="order-2 lg:order-1">
          {error ? (
            <EmptyState
              title="Couldn't load assistants"
              description={`${error.message}. If this mentions a missing relation, the portal migration hasn't been applied yet.`}
            />
          ) : assistants && assistants.length > 0 ? (
            <Table head={["Name", "Role", "Model", "Creativity", "Added", ""]}>
              {assistants.map((a) => (
                <tr key={a.id} className="hover:bg-white/3 transition-colors align-top">
                  <Td>
                    <div className="font-medium">{a.name}</div>
                    {a.system_prompt && (
                      <div className="text-[11px] text-white/40 mt-0.5 max-w-xs line-clamp-2">
                        {a.system_prompt}
                      </div>
                    )}
                  </Td>
                  <Td className="text-white/70">{a.role}</Td>
                  <Td>
                    <code className="text-[11px] text-[#00D4FF]">{a.model}</code>
                  </Td>
                  <Td>
                    <Badge tone={a.temperature > 1 ? "purple" : a.temperature < 0.4 ? "blue" : "green"}>
                      {a.temperature < 0.4 ? "precise" : a.temperature > 1 ? "creative" : "balanced"}
                    </Badge>
                  </Td>
                  <Td className="text-white/40 text-xs whitespace-nowrap">{formatDate(a.created_at)}</Td>
                  <Td>
                    <ActionForm action={deleteAiAssistant} submitLabel="Delete" compact>
                      <input type="hidden" name="id" value={a.id} />
                    </ActionForm>
                  </Td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState
              title="No AI assistants yet"
              description="Create one to draft replies, answer questions and hand off to a human when it can't help."
            />
          )}

          {!hasApiKey && assistants && assistants.length > 0 && (
            <div className="mt-4 bg-[#F87171]/8 border border-[#F87171]/25 rounded-xl p-4">
              <div className="text-sm font-semibold text-[#F87171] mb-1">
                ANTHROPIC_API_KEY is not set
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Your assistants are saved, but they cannot generate replies without an API
                key. Add <code className="text-white/70">ANTHROPIC_API_KEY</code> in Vercel →
                Settings → Environment Variables and redeploy. Chatbots, the FAQ bot and
                keyword automations keep working either way.
              </p>
            </div>
          )}

          <p className="text-xs text-white/35 mt-4">
            An active assistant answers inbound messages that no chatbot, FAQ entry or
            automation matched. If a customer uses one of its handoff keywords, it stops
            replying on that chat and flags the conversation for a human.
          </p>
        </div>

        <Card className="order-1 lg:order-2">
          <h2 className="font-semibold mb-1">Create AI Assistant</h2>
          <p className="text-sm text-white/50 mb-5">
            The role and instructions shape every reply it writes.
          </p>

          <ActionForm action={saveAiAssistant} submitLabel="Create AI Assistant" resetOnSuccess>
            <div className="space-y-4">
              <Field label="Name" name="name" required placeholder="Support Sam" />
              <Field
                label="Role"
                name="role"
                placeholder="Support agent"
                hint="Sales rep, support agent, booking assistant…"
              />
              <SelectField
                label="Model"
                name="model"
                defaultValue="claude-sonnet-5"
                options={ASSISTANT_MODELS.map((m) => ({ value: m.value, label: m.label }))}
              />
              <TextareaField
                label="Instructions"
                name="system_prompt"
                rows={5}
                placeholder="You are the support agent for a fashion brand. Be warm and concise. Never promise delivery dates. If asked about refunds, hand off to a human."
              />
              <Field
                label="Creativity"
                name="temperature"
                type="number"
                defaultValue="0.7"
                hint="0 = strict and repeatable, 1 = varied, 2 = very loose"
              />
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
