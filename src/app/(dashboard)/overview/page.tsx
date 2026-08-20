import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { PageHeader, Card, StatCard, Badge, statusTone } from "@/components/ui/primitives";

// Counts are head:true so the overview never pulls whole tables to show a
// number. Errors are tolerated per-query: a missing table shows zero rather
// than failing the whole page.
export default async function OverviewPage() {
  const { orgId, orgName } = await requireOrg();
  const supabase = await createClient();

  const [contacts, conversations, messages, campaigns, bots, reminders, recentConvos, connection] =
    await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabase
        .from("chatbot_flows")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("is_active", true),
      supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "pending"),
      supabase
        .from("conversations")
        .select("id, status, last_message_at, contacts(name, wa_id)")
        .eq("org_id", orgId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(6),
      supabase.from("waba_connections").select("status").eq("org_id", orgId).maybeSingle(),
    ]);

  const notConnected = !connection.data;

  return (
    <div className="p-6 md:p-8">
      <PageHeader title={orgName} subtitle="Everything happening across your workspace." />

      {notConnected && (
        <div className="glass-card p-5 mb-6 border-l-2 border-l-[#00FF87]">
          <div className="font-semibold text-[#00FF87] text-sm mb-1">
            Connect a WhatsApp number to start
          </div>
          <p className="text-sm text-white/60 mb-3">
            Nothing can be sent or received until a number from your Meta WhatsApp Business
            Account is connected.
          </p>
          <Link href="/settings" className="btn-primary text-xs py-2 px-3.5">
            Go to Settings
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Contacts" value={contacts.count ?? 0} />
        <StatCard label="Conversations" value={conversations.count ?? 0} />
        <StatCard label="Messages" value={messages.count ?? 0} />
        <StatCard label="Campaigns" value={campaigns.count ?? 0} />
        <StatCard label="Active bots" value={bots.count ?? 0} />
        <StatCard label="Reminders due" value={reminders.count ?? 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent conversations</h2>
            <Link href="/inbox" className="text-xs text-[#00D4FF] hover:underline">
              Open inbox
            </Link>
          </div>
          {recentConvos.data && recentConvos.data.length > 0 ? (
            <div className="space-y-3">
              {recentConvos.data.map((c) => {
                const contact = c.contacts as { name: string | null; wa_id: string } | null;
                return (
                  <Link
                    key={c.id}
                    href={`/inbox?c=${c.id}`}
                    className="flex items-center justify-between gap-3 hover:bg-white/3 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                  >
                    <span className="text-sm truncate">
                      {contact?.name || contact?.wa_id || "Unknown"}
                    </span>
                    <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-white/40">
              No conversations yet. They appear as soon as someone messages your number.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-4">Set up checklist</h2>
          <div className="space-y-3">
            {[
              { done: !notConnected, label: "Connect a WhatsApp number", href: "/settings" },
              { done: (contacts.count ?? 0) > 0, label: "Add your first contact", href: "/contacts" },
              { done: (bots.count ?? 0) > 0, label: "Create a chatbot", href: "/chatbot" },
              { done: (campaigns.count ?? 0) > 0, label: "Run a campaign", href: "/campaigns" },
            ].map((step) => (
              <Link
                key={step.label}
                href={step.href}
                className="flex items-center gap-3 hover:bg-white/3 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] flex-shrink-0 ${
                    step.done
                      ? "bg-[#00FF87]/15 border-[#00FF87]/40 text-[#00FF87]"
                      : "border-white/20 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={`text-sm ${step.done ? "text-white/40 line-through" : "text-white/80"}`}>
                  {step.label}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
