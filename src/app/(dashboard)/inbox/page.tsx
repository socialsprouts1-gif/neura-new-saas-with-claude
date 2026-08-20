import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { EmptyState, Badge, statusTone } from "@/components/ui/primitives";
import Composer from "./Composer";

function initials(name: string | null, waId: string) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
  }
  return waId.slice(-2);
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// The message body is stored as the raw type-specific payload Meta sent, so
// rendering has to cope with more than plain text.
function renderBody(type: string, content: Record<string, unknown>): string {
  if (type === "text") return String(content.body ?? "");
  if (type === "template") return `Template: ${String(content.template_name ?? "—")}`;
  if (type === "image" || type === "video" || type === "document" || type === "audio") {
    const caption = content.caption ? ` — ${String(content.caption)}` : "";
    return `[${type}]${caption}`;
  }
  if (type === "interactive" || type === "button") {
    return String(
      (content as { button_reply?: { title?: string }; list_reply?: { title?: string } }).button_reply?.title ??
        (content as { list_reply?: { title?: string } }).list_reply?.title ??
        "[interactive]"
    );
  }
  return `[${type}]`;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { orgId } = await requireOrg();
  const { c: selectedId } = await searchParams;
  const supabase = await createClient();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, status, last_message_at, contact_id, contacts(id, wa_id, name)")
    .eq("org_id", orgId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    return (
      <div className="p-6 md:p-8">
        <EmptyState
          title="Couldn't load conversations"
          description={`${error.message}. If this mentions a missing relation, the database migrations haven't been applied yet.`}
        />
      </div>
    );
  }

  const list = conversations ?? [];
  const active = selectedId ? list.find((c) => c.id === selectedId) : list[0];

  const { data: messages } = active
    ? await supabase
        .from("messages")
        .select("id, direction, type, content, status, created_at")
        .eq("conversation_id", active.id)
        .order("created_at")
        .limit(200)
    : { data: null };

  if (list.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <EmptyState
          title="No conversations yet"
          description="Conversations appear here as soon as someone messages your connected WhatsApp number. Connect a number in Settings to start receiving them."
          action={
            <Link href="/settings" className="btn-primary text-sm">
              Go to Settings
            </Link>
          }
        />
      </div>
    );
  }

  const contact = active?.contacts as { id: string; wa_id: string; name: string | null } | null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Conversation list */}
      <aside className="w-72 border-r border-white/8 flex flex-col flex-shrink-0 min-h-0">
        <div className="px-4 h-14 flex items-center border-b border-white/8 flex-shrink-0">
          <h1 className="font-semibold text-sm">Inbox</h1>
          <span className="ml-auto text-xs text-white/40">{list.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.map((conv) => {
            const ct = conv.contacts as { wa_id: string; name: string | null } | null;
            const isActive = conv.id === active?.id;
            return (
              <Link
                key={conv.id}
                href={`/inbox?c=${conv.id}`}
                className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 transition-colors ${
                  isActive ? "bg-[#00FF87]/8" : "hover:bg-white/3"
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FF87]/25 to-[#00D4FF]/25 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {initials(ct?.name ?? null, ct?.wa_id ?? "")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{ct?.name || ct?.wa_id}</div>
                  <div className="text-[11px] text-white/40 truncate">{ct?.wa_id}</div>
                </div>
                <span className="text-[10px] text-white/30 flex-shrink-0">
                  {timeAgo(conv.last_message_at)}
                </span>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Thread */}
      <section className="flex-1 flex flex-col min-w-0 min-h-0">
        {active && contact ? (
          <>
            <header className="px-5 h-14 flex items-center gap-3 border-b border-white/8 flex-shrink-0">
              <div>
                <div className="text-sm font-semibold">{contact.name || contact.wa_id}</div>
                <div className="text-[11px] text-white/40 font-mono">{contact.wa_id}</div>
              </div>
              <div className="ml-auto">
                <Badge tone={statusTone(active.status)}>{active.status}</Badge>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {(messages ?? []).length === 0 && (
                <p className="text-sm text-white/40 text-center py-8">No messages in this conversation yet.</p>
              )}
              {(messages ?? []).map((m) => {
                const outbound = m.direction === "outbound";
                return (
                  <div key={m.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        outbound
                          ? "bg-[#00FF87]/12 border border-[#00FF87]/20"
                          : "bg-white/5 border border-white/10"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {renderBody(m.type, m.content)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-white/35">
                          {new Date(m.created_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {outbound && (
                          <span
                            className={`text-[10px] ${
                              m.status === "failed" ? "text-red-400" : "text-white/35"
                            }`}
                          >
                            {m.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Composer orgId={orgId} contactId={contact.id} />
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-sm text-white/40">
            Select a conversation
          </div>
        )}
      </section>
    </div>
  );
}
