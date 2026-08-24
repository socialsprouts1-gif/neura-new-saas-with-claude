import Link from "next/link";
import { Workflow } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { toggleChatbotFlow, deleteChatbotFlow } from "../portal-actions";
import NewBotButton from "./NewBotButton";
import ActionForm from "@/components/ui/ActionForm";
import { PageHeader, Card, StatCard, Badge, EmptyState } from "@/components/ui/primitives";
import { nodeDef, type FlowNode } from "@/types/flow";

const TRIGGER_LABEL: Record<string, string> = {
  keyword: "Keyword",
  welcome: "First message",
  fallback: "No match",
  menu: "Menu",
  business_hours: "Outside hours",
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
  const totalNodes = all.reduce(
    (sum, f) => sum + (Array.isArray(f.nodes) ? f.nodes.length : 0),
    0
  );

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
        <p className="text-sm text-white/50 max-w-2xl">
          Active bots are matched against every inbound message. A bot that ends on a question or
          a set of buttons keeps the conversation where it is, so the next reply continues the
          flow instead of starting over.
        </p>
        <NewBotButton />
      </div>

      {error ? (
        <EmptyState
          title="Couldn't load bots"
          description={`${error.message}. If this mentions a missing relation or column, run supabase/setup.sql again — the flow builder added columns.`}
        />
      ) : all.length > 0 ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {all.map((flow) => {
            const nodes = (Array.isArray(flow.nodes) ? flow.nodes : []) as FlowNode[];
            const edges = Array.isArray(flow.edges) ? flow.edges : [];
            const kinds = [...new Set(nodes.map((n) => n.kind).filter(Boolean))];

            return (
              <Card key={flow.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <Link
                      href={`/chatbot/${flow.id}`}
                      className="font-semibold hover:text-[#00FF87] transition-colors block truncate"
                    >
                      {flow.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge tone={flow.is_active ? "green" : "grey"}>
                        {flow.is_active ? "active" : "draft"}
                      </Badge>
                      <Badge tone="purple">{TRIGGER_LABEL[flow.trigger_type] ?? flow.trigger_type}</Badge>
                      {flow.trigger_value && (
                        <code className="text-[11px] text-[#00D4FF]">{flow.trigger_value}</code>
                      )}
                    </div>
                  </div>
                </div>

                {/* What the flow is made of, at a glance — more useful on a
                    list than the first message, which is usually a greeting. */}
                <div className="flex flex-wrap gap-1.5 mb-4 min-h-[26px]">
                  {kinds.slice(0, 6).map((kind) => {
                    const def = nodeDef(kind);
                    if (!def) return null;
                    return (
                      <span
                        key={kind}
                        className="text-[10px] px-2 py-1 rounded-md border"
                        style={{
                          color: def.accent,
                          borderColor: `${def.accent}33`,
                          background: `${def.accent}0F`,
                        }}
                      >
                        {def.label}
                      </span>
                    );
                  })}
                  {kinds.length > 6 && (
                    <span className="text-[10px] text-white/35 px-1 py-1">+{kinds.length - 6}</span>
                  )}
                  {kinds.length === 0 && (
                    <span className="text-[11px] text-white/30">Nothing built yet</span>
                  )}
                </div>

                <div className="text-[11px] text-white/35 mb-4">
                  {nodes.length} node{nodes.length === 1 ? "" : "s"} · {edges.length} connection
                  {edges.length === 1 ? "" : "s"} · v{flow.version}
                </div>

                <div className="flex gap-2 mt-auto">
                  <Link href={`/chatbot/${flow.id}`} className="btn-secondary text-xs flex-1 justify-center">
                    <Workflow className="w-3.5 h-3.5" />
                    Open builder
                  </Link>
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
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No bots yet"
          description="Create your first bot, then drag components onto the canvas to build the conversation."
          action={<NewBotButton />}
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
            ["Collect answers", "Ask Question saves the reply to a variable you can use later with {{name}}."],
            ["Decide", "Condition splits the flow on a variable, a tag, or anything you collected earlier."],
            ["Reach other systems", "HTTP Request calls any URL and stores the response — that is how you reach a CRM or a sheet."],
            ["Fall back to AI", "AI Agent hands the turn to your assistant when the scripted paths run out."],
            ["Know what ran", "Every run is recorded node by node in Automations → Bot activity."],
          ].map(([title, body]) => (
            <div key={title}>
              <div className="text-sm font-medium text-white/80 mb-1">{title}</div>
              <p className="text-xs text-white/45 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
