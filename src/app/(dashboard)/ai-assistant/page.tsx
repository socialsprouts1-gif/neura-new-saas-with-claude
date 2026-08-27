import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { HeroHeader, EmptyState } from "@/components/ui/primitives";
import AssistantTable, { type AssistantRow } from "./AssistantTable";
import type { AiAssistant } from "@/types/portal";

export default async function AiAssistantPage() {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ai_assistants")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const assistants: AssistantRow[] = ((data ?? []) as AiAssistant[]).map((assistant) => ({
    id: assistant.id,
    name: assistant.name,
    role: assistant.role,
    provider: assistant.provider,
    model: assistant.model,
    is_active: assistant.is_active,
  }));

  return (
    <div className="p-6 md:p-8">
      <HeroHeader
        title="AI Assistants"
        subtitle="Configure AI assistants for your team and automations."
      />

      {error ? (
        <EmptyState
          title="Couldn't load assistants"
          description={`${error.message}. If this mentions a missing column, run the latest migration in supabase/setup.sql.`}
        />
      ) : (
        <AssistantTable assistants={assistants} />
      )}
    </div>
  );
}
