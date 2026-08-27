"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Loader2, MoreVertical, Pencil, UserPlus, X } from "lucide-react";
import {
  assignConversation,
  renameContact,
  setContactOptIn,
  setConversationStatus,
} from "@/app/(dashboard)/actions";
import type { Teammate } from "./ConversationList";

export default function ThreadHeader({
  conversationId,
  contactId,
  name,
  waId,
  optedIn,
  status,
  botEnabled,
  windowOpen,
  assignedTo,
  teammates,
  onToggleBot,
}: {
  conversationId: string;
  contactId: string;
  name: string;
  waId: string;
  optedIn: boolean;
  status: string;
  botEnabled: boolean;
  /** Inside WhatsApp's 24-hour service window, so free-form replies deliver. */
  windowOpen: boolean;
  assignedTo: string | null;
  teammates: Teammate[];
  onToggleBot: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);

  const run = (work: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await work();
      if (!result.ok) setError(result.error ?? "That didn't work.");
      menu.current?.removeAttribute("open");
      router.refresh();
    });

  const assignee = teammates.find((mate) => mate.userId === assignedTo);

  return (
    <header className="px-5 py-3 border-b border-white/8 flex-shrink-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent/30 to-accent2/25 flex items-center justify-center text-sm font-bold">
            {(name.trim() || waId).slice(0, 2).toUpperCase()}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--app-bg)] ${
              windowOpen ? "bg-accent" : "bg-white/25"
            }`}
            title={windowOpen ? "Service window open" : "Service window closed"}
          />
        </div>

        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    run(() => renameContact(contactId, draft));
                    setEditing(false);
                  }
                  if (event.key === "Escape") setEditing(false);
                }}
                autoFocus
                className="bg-white/8 border border-white/15 rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-accent/50"
              />
              <button
                type="button"
                onClick={() => {
                  run(() => renameContact(contactId, draft));
                  setEditing(false);
                }}
                aria-label="Save name"
                className="p-1.5 rounded-lg text-accent-ink hover:bg-white/8"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(name);
                  setEditing(false);
                }}
                aria-label="Cancel"
                className="p-1.5 rounded-lg text-white/40 hover:bg-white/8"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-semibold truncate">{name || waId}</span>
              <button
                type="button"
                onClick={() => {
                  setDraft(name);
                  setEditing(true);
                }}
                aria-label="Rename contact"
                className="p-1 rounded-lg text-accent-ink/70 hover:text-accent-ink hover:bg-white/8 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="text-xs text-white/45 font-mono">{waId}</div>
        </div>

        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {assignee && (
            <span className="text-[11px] text-accent2-ink hidden sm:inline">
              {assignee.name}
            </span>
          )}

          <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-white/55">
            <span
              className={`w-2 h-2 rounded-full ${windowOpen ? "bg-accent" : "bg-white/25"}`}
            />
            {windowOpen ? "Window open" : "Window closed"}
          </span>

          {/* Opting out stops campaigns reaching this person; it does not
              gag a reply inside an open window, which is a response to a
              message they sent. */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/55">OptIn</span>
            <button
              type="button"
              role="switch"
              aria-checked={optedIn}
              aria-label="Opted in to campaigns"
              title={
                optedIn
                  ? "Opted in — campaigns and broadcasts may reach this contact"
                  : "Opted out — campaigns will skip this contact"
              }
              disabled={pending}
              onClick={() => run(() => setContactOptIn(contactId, !optedIn))}
              className="disabled:opacity-50"
            >
              <span
                className={`relative block w-11 h-6 rounded-full transition-colors ${
                  optedIn ? "bg-accent" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                    optedIn ? "left-5.5" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleBot}
            title={botEnabled ? "Bot is answering this chat" : "Bot is paused on this chat"}
            aria-label={botEnabled ? "Pause the bot" : "Resume the bot"}
            className={`p-2 rounded-lg border transition-colors ${
              botEnabled
                ? "border-accent/30 bg-accent/10 text-accent-ink"
                : "border-white/12 text-white/40 hover:text-white"
            }`}
          >
            <Bot className="w-4 h-4" />
          </button>

          <details ref={menu} className="relative">
            <summary
              aria-label="Conversation actions"
              className="list-none cursor-pointer p-2 rounded-lg text-white/45 hover:text-white hover:bg-white/8 transition-colors"
            >
              {pending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MoreVertical className="w-4 h-4" />
              )}
            </summary>

            <div className="absolute right-0 top-full mt-1.5 z-30 w-60 rounded-xl border border-white/12 bg-[var(--surface-1)] shadow-2xl py-1.5">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/35 flex items-center gap-1.5">
                <UserPlus className="w-3 h-3" />
                Assign to
              </div>
              {teammates.map((mate) => (
                <button
                  key={mate.userId}
                  type="button"
                  onClick={() => run(() => assignConversation(conversationId, mate.userId))}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/6 transition-colors"
                >
                  <Check
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      assignedTo === mate.userId ? "text-accent-ink" : "opacity-0"
                    }`}
                  />
                  <span className="truncate">{mate.name}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => run(() => assignConversation(conversationId, null))}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/6 transition-colors"
              >
                <Check
                  className={`w-3.5 h-3.5 flex-shrink-0 ${!assignedTo ? "text-accent-ink" : "opacity-0"}`}
                />
                Nobody
              </button>

              <div className="h-px bg-white/8 my-1.5" />
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/35">
                Status
              </div>
              {(["open", "pending", "resolved", "closed"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => run(() => setConversationStatus(conversationId, option))}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/6 transition-colors capitalize"
                >
                  <Check
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      status === option ? "text-accent-ink" : "opacity-0"
                    }`}
                  />
                  {option}
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 mt-2" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}
