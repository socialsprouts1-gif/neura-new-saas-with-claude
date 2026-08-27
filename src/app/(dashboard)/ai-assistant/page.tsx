import Link from "next/link";
import { ChevronRight, Database, KeyRound, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { PageHeader, StatCard, EmptyState, Badge } from "@/components/ui/primitives";
import { providerById } from "@/lib/ai-providers";
import NewAssistantPanel from "./NewAssistantPanel";
import type { AiAssistant } from "@/types/portal";

export default async function AiAssistantPage() {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const [{ data, error }, { count: knowledgeCount }] = await Promise.all([
    supabase
      .from("ai_assistants")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("assistant_knowledge")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("is_active", true),
  ]);

  const assistants = (data ?? []) as AiAssistant[];
  const live = assistants.filter((assistant) => assistant.is_active).length;
  const providers = new Set(assistants.map((assistant) => assistant.provider)).size;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="AI Assistants"
        subtitle="Choose the model, bring your own API key, and give it the knowledge it is allowed to answer from."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Assistants" value={assistants.length} />
        <StatCard label="Live" value={live} hint="Answering unmatched messages" />
        <StatCard label="Providers in use" value={providers} />
        <StatCard label="Knowledge entries" value={knowledgeCount ?? 0} />
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="order-2 lg:order-1 space-y-3">
          {error ? (
            <EmptyState
              title="Couldn't load assistants"
              description={`${error.message}. If this mentions a missing column, run the latest migration in supabase/setup.sql.`}
            />
          ) : assistants.length === 0 ? (
            <EmptyState
              title="No AI assistants yet"
              description="Create one to answer anything your chatbots, FAQ entries and automations didn't match."
            />
          ) : (
            assistants.map((assistant) => {
              const provider = providerById(assistant.provider);
              return (
                <Link
                  key={assistant.id}
                  href={`/ai-assistant/${assistant.id}`}
                  className="glass-card p-5 flex items-start gap-4 hover:border-accent/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 grid place-items-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-accent-ink" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold truncate">{assistant.name}</span>
                      <Badge tone={assistant.is_active ? "green" : "grey"}>
                        {assistant.is_active ? "live" : "paused"}
                      </Badge>
                    </div>
                    <div className="text-xs text-white/45 mt-0.5">{assistant.role}</div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px] text-white/40">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent2" />
                        {provider?.name ?? assistant.provider}
                      </span>
                      <code className="text-accent2-ink">{assistant.model}</code>
                      <span className="inline-flex items-center gap-1">
                        <KeyRound className="w-3 h-3" />
                        {assistant.api_key_encrypted ? "own key" : "platform key"}
                      </span>
                      {assistant.use_knowledge_base && (
                        <span className="inline-flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          knowledge on
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-white/25 group-hover:text-white/60 flex-shrink-0 mt-1" />
                </Link>
              );
            })
          )}

          <p className="text-xs text-white/35 pt-1">
            A live assistant answers inbound messages that no chatbot, FAQ entry or automation
            matched. If a customer uses one of its handoff keywords, it stops replying on that
            chat and flags the conversation for a human.
          </p>
        </div>

        <div className="order-1 lg:order-2">
          <NewAssistantPanel />
        </div>
      </div>
    </div>
  );
}
