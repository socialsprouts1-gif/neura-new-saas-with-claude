import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import BotToolbar from "./BotToolbar";
import ChatbotTable, { type BotRow } from "./ChatbotTable";
import { PageHeader, Card, StatCard, EmptyState } from "@/components/ui/primitives";
import type { FlowNode } from "@/types/flow";

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
  const totalNodes = all.reduce(
    (sum, f) => sum + (Array.isArray(f.nodes) ? f.nodes.length : 0),
    0
  );

  const rows: BotRow[] = all.map((flow) => ({
    id: flow.id,
    name: flow.name,
    is_active: flow.is_active,
    trigger_type: flow.trigger_type,
    trigger_value: flow.trigger_value,
    nodes: (Array.isArray(flow.nodes) ? flow.nodes : []) as FlowNode[],
    edges: Array.isArray(flow.edges) ? flow.edges : [],
    version: flow.version,
  }));

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Chatbot"
        subtitle="Build conversations on a canvas. Drag components, connect them, and every path runs on real WhatsApp messages."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Bots" value={all.length} />
        <StatCard label="Active" value={active} />
        <StatCard label="Draft" value={all.length - active} />
        <StatCard label="Nodes built" value={totalNodes} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <p className="text-sm text-white/50 max-w-xl">
          Active bots are matched against every inbound message. A bot that ends on a question or
          a set of buttons keeps the conversation where it is, so the next reply continues the
          flow instead of starting over.
        </p>
        <BotToolbar />
      </div>

      {error ? (
        <EmptyState
          title="Couldn't load bots"
          description={`${error.message}. If this mentions a missing relation or column, run supabase/setup.sql again — the flow builder added columns.`}
        />
      ) : rows.length > 0 ? (
        <ChatbotTable bots={rows} />
      ) : (
        <EmptyState
          title="No bots yet"
          description="Start from the example bot to see a working flow, or create an empty one and drag components onto the canvas."
          action={<BotToolbar />}
        />
      )}

      <Card className="mt-6">
        <h2 className="font-semibold mb-1">How the canvas works</h2>
        <p className="text-sm text-white/50 mb-5">
          Every bot starts from an <strong className="text-white/75">On Message</strong> trigger and
          follows the connections you draw.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ["Branch on a tap", "Buttons and list rows each get their own outlet, so every choice can lead somewhere different."],
            ["Wire every outlet", "An outlet with no connection ends the conversation silently — that is how \u201ctalk to a human\u201d quietly does nothing."],
            ["Collect answers", "Ask Question saves the reply to a variable you can use later with {{name}}."],
            ["Decide", "Condition splits the flow on a variable, a tag, or anything you collected earlier."],
            ["Reach other systems", "HTTP Request calls any URL and stores the response \u2014 that is how you reach a CRM or a sheet."],
            ["Know what ran", "Every run is recorded node by node in Automations \u2192 Bot activity."],
          ].map(([title, copy]) => (
            <div key={title}>
              <div className="text-sm font-medium text-white/80 mb-1">{title}</div>
              <p className="text-xs text-white/45 leading-relaxed">{copy}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
