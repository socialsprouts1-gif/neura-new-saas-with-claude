"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Bot, FileText, Image as ImageIcon, Loader2, Paperclip, Send, Smile, Zap } from "lucide-react";
import EmojiPicker from "./EmojiPicker";

export interface CannedMessage {
  id: string;
  shortcut: string;
  title: string;
  body: string;
}

export interface TemplateOption {
  id: string;
  name: string;
  language: string;
  category: string;
}

export interface MediaOption {
  id: string;
  name: string;
  url: string;
  type: string;
}

// Posts through the authenticated send endpoint rather than a server action,
// so outbound sending has one code path shared with any future API client.
export default function Composer({
  orgId,
  contactId,
  windowOpen,
  canned,
  templates,
  media,
  botEnabled,
  onToggleBot,
}: {
  orgId: string;
  contactId: string;
  /** Inside the 24-hour service window, free-form text delivers. */
  windowOpen: boolean;
  canned: CannedMessage[];
  templates: TemplateOption[];
  media: MediaOption[];
  botEnabled: boolean;
  onToggleBot: () => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"emoji" | "canned" | "media" | "template" | null>(null);

  const post = async (payload: Record<string, unknown>) => {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, contactId, ...payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result?.error ?? `Send failed (${response.status})`);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network error — the message was not sent.");
      return false;
    } finally {
      setSending(false);
    }
  };

  const sendText = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = body.trim();
    if (!text) return;
    if (await post({ body: text })) setBody("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line — the convention every chat
    // client shares, and the one people's hands already know.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendText();
    }
  };

  const insert = (text: string) => {
    setBody((current) => (current ? `${current}${text}` : text));
    input.current?.focus();
  };

  return (
    <div className="border-t border-white/8 bg-[var(--surface-1)]/60 flex-shrink-0">
      {/* Window state and the two sends that do not go through the text box */}
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3">
        <span className={`text-xs ${windowOpen ? "text-white/45" : "text-[#FACC15]"}`}>
          {windowOpen
            ? "Free-form messages allowed (24h window)"
            : "Window closed — only an approved template will deliver"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Panel
            open={panel === "template"}
            onToggle={() => setPanel(panel === "template" ? null : "template")}
            align="right"
            trigger={
              <>
                <FileText className="w-3.5 h-3.5" />
                Send template
              </>
            }
            triggerClass={
              windowOpen
                ? "btn-secondary text-xs py-2 px-3.5"
                : "btn-primary text-xs py-2 px-3.5"
            }
          >
            <div className="w-72 max-h-64 overflow-y-auto p-1.5">
              {templates.length === 0 ? (
                <p className="px-2.5 py-3 text-[11px] text-white/40 leading-relaxed">
                  No approved templates yet. Create one under WhatsApp templates and submit it to
                  Meta — only approved templates can open a closed window.
                </p>
              ) : (
                templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    disabled={sending}
                    onClick={async () => {
                      if (
                        await post({
                          templateName: template.name,
                          language: template.language,
                          components: [],
                        })
                      ) {
                        setPanel(null);
                      }
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/6 transition-colors disabled:opacity-50"
                  >
                    <div className="text-sm font-medium truncate">{template.name}</div>
                    <div className="text-[10px] text-white/40">
                      {template.language} · {template.category.toLowerCase()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 px-4 pt-2" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={sendText} className="flex items-end gap-2 p-4">
        <Panel
          open={panel === "media"}
          onToggle={() => setPanel(panel === "media" ? null : "media")}
          trigger={<Paperclip className="w-4 h-4" />}
          triggerClass="p-2.5 rounded-xl text-white/45 hover:text-white hover:bg-white/8 transition-colors"
          triggerLabel="Attach media"
        >
          <div className="w-72 max-h-64 overflow-y-auto p-1.5">
            {media.length === 0 ? (
              <p className="px-2.5 py-3 text-[11px] text-white/40 leading-relaxed">
                Nothing in the Gallery yet. Upload there first — WhatsApp needs a hosted URL, so
                attachments come from your own media library.
              </p>
            ) : (
              media.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    // The send endpoint takes text; a media URL in the body
                    // is what WhatsApp will preview for the customer.
                    insert(asset.url);
                    setPanel(null);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/6 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                  <span className="text-sm truncate">{asset.name}</span>
                  <span className="ml-auto text-[10px] text-white/30">{asset.type}</span>
                </button>
              ))
            )}
          </div>
        </Panel>

        <textarea
          ref={input}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Type a message..."
          className="flex-1 min-w-0 bg-white/5 border border-white/12 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/35 focus:outline-none focus:border-accent/50 transition-all resize-none max-h-32"
        />

        <Panel
          open={panel === "emoji"}
          onToggle={() => setPanel(panel === "emoji" ? null : "emoji")}
          align="right"
          trigger={<Smile className="w-4 h-4" />}
          triggerClass="p-2.5 rounded-xl text-white/45 hover:text-white hover:bg-white/8 transition-colors"
          triggerLabel="Emoji"
        >
          <EmojiPicker onPick={(emoji) => insert(emoji)} />
        </Panel>

        <Panel
          open={panel === "canned"}
          onToggle={() => setPanel(panel === "canned" ? null : "canned")}
          align="right"
          trigger={<Zap className="w-4 h-4" />}
          triggerClass="p-2.5 rounded-xl text-white/45 hover:text-white hover:bg-white/8 transition-colors"
          triggerLabel="Canned messages"
        >
          <div className="w-80 max-h-64 overflow-y-auto p-1.5">
            {canned.length === 0 ? (
              <p className="px-2.5 py-3 text-[11px] text-white/40 leading-relaxed">
                No canned messages yet. Save the replies you type most often under Canned messages
                and they land here.
              </p>
            ) : (
              canned.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setBody(entry.body);
                    setPanel(null);
                    input.current?.focus();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/6 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{entry.title}</span>
                    <code className="text-[10px] text-accent2-ink flex-shrink-0">
                      /{entry.shortcut}
                    </code>
                  </div>
                  <p className="text-[11px] text-white/40 line-clamp-2 mt-0.5">{entry.body}</p>
                </button>
              ))
            )}
          </div>
        </Panel>

        <button
          type="button"
          onClick={onToggleBot}
          aria-label={botEnabled ? "Pause the bot on this chat" : "Resume the bot on this chat"}
          title={
            botEnabled
              ? "Bot is answering. Sending a reply pauses it if the assistant is set to stand down."
              : "Bot is paused on this chat"
          }
          className={`p-2.5 rounded-xl border transition-colors ${
            botEnabled
              ? "border-accent/30 bg-accent/10 text-accent-ink"
              : "border-white/12 text-white/40 hover:text-white"
          }`}
        >
          <Bot className="w-4 h-4" />
        </button>

        <button
          type="submit"
          disabled={sending || !body.trim()}
          aria-label="Send"
          className="w-11 h-11 rounded-full bg-accent text-[#050508] grid place-items-center hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-40 flex-shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}

/** A popover anchored to its trigger, closed by clicking the trigger again. */
function Panel({
  open,
  onToggle,
  trigger,
  triggerClass,
  triggerLabel,
  align = "left",
  children,
}: {
  open: boolean;
  onToggle: () => void;
  trigger: React.ReactNode;
  triggerClass: string;
  triggerLabel?: string;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex-shrink-0">
      <button type="button" onClick={onToggle} aria-label={triggerLabel} className={triggerClass}>
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute bottom-full mb-2 z-30 rounded-xl border border-white/12 bg-[var(--surface-1)] shadow-2xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
