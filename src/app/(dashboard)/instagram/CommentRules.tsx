"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { ruleProblem } from "@/lib/instagram";
import {
  deleteCommentRule,
  saveCommentRule,
  setCommentRuleActive,
} from "../instagram-actions";

// "When somebody comments X, send them Y."
//
// The whole feature in one form. Two fields do the work and the rest are
// qualifiers, so the form is ordered that way rather than alphabetically
// or by database column.
//
// The problem is shown while typing rather than on submit: a rule that
// neither DMs nor replies saves perfectly well and then sits there doing
// nothing, which is the kind of thing somebody finds out a week later by
// wondering why their post got no replies.

export interface RuleRow {
  id: string;
  name: string;
  keywords: string[];
  media_id: string | null;
  dm_message: string | null;
  public_reply: string | null;
  is_active: boolean;
  sent_count: number;
}

const FIELD =
  "w-full bg-white/5 border border-white/12 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-colors disabled:opacity-60";

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="block mb-1.5">
      <span className="block text-xs font-medium text-white/70">{children}</span>
      {hint && <span className="block text-[12px] text-white/35 mt-0.5 leading-relaxed">{hint}</span>}
    </span>
  );
}

const EMPTY = {
  id: "",
  name: "",
  keywords: "",
  mediaId: "",
  dmMessage: "",
  publicReply: "",
};

function Editor({
  rule,
  connectionId,
  trigger,
}: {
  rule?: RuleRow;
  connectionId: string | null;
  trigger: "new" | "edit";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(
    rule
      ? {
          id: rule.id,
          name: rule.name,
          keywords: rule.keywords.join(", "),
          mediaId: rule.media_id ?? "",
          dmMessage: rule.dm_message ?? "",
          publicReply: rule.public_reply ?? "",
        }
      : EMPTY
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = ruleProblem({
    name: draft.name,
    dmMessage: draft.dmMessage,
    publicReply: draft.publicReply,
  });

  const set = (patch: Partial<typeof draft>) => setDraft((old) => ({ ...old, ...patch }));

  const save = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);

    const result = await saveCommentRule({
      id: draft.id || undefined,
      name: draft.name,
      keywords: draft.keywords,
      mediaId: draft.mediaId,
      dmMessage: draft.dmMessage,
      publicReply: draft.publicReply,
      connectionId,
    }).catch(() => ({ ok: false as const, error: "That could not be saved just now." }));

    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That could not be saved.");
      return;
    }
    toast.success(result.message ?? "Saved.");
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      {trigger === "new" ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          New rule
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn-quiet btn-compact text-xs">
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? "Edit rule" : "When somebody comments…"}
        description="Instagram lets you answer a comment privately for seven days afterwards. That private reply is the DM — the person does not have to have messaged you first."
        size="lg"
        dismissable={!busy}
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="btn-quiet text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || Boolean(problem)}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save rule"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <Label>Name — only you see this</Label>
            <input
              value={draft.name}
              onChange={(event) => set({ name: event.target.value })}
              disabled={busy}
              placeholder="Price enquiries"
              className={FIELD}
            />
          </label>

          <label className="block">
            <Label hint="Comma separated. Matched on whole words, so “hi” does not fire on “shipping”. Leave empty to answer every comment on the post.">
              Words to watch for
            </Label>
            <input
              value={draft.keywords}
              onChange={(event) => set({ keywords: event.target.value })}
              disabled={busy}
              placeholder="price, cost, how much"
              className={FIELD}
            />
          </label>

          <label className="block">
            <Label hint="Sent privately, as a DM. This is the one that matters.">
              Send them this
            </Label>
            <textarea
              value={draft.dmMessage}
              onChange={(event) => set({ dmMessage: event.target.value })}
              disabled={busy}
              rows={4}
              placeholder="Hi! Here's the price list: neurachat.in/pricing"
              className={FIELD}
            />
          </label>

          <label className="block">
            <Label hint="Optional, and public. A thread of identical bot replies is what makes an account look automated — usually best left empty.">
              Reply under the comment
            </Label>
            <input
              value={draft.publicReply}
              onChange={(event) => set({ publicReply: event.target.value })}
              disabled={busy}
              placeholder="Just sent you a DM 💬"
              className={FIELD}
            />
          </label>

          <label className="block">
            <Label hint="Optional. Leave empty and the rule watches every post. Paste a media ID to limit it to one.">
              Only on one post
            </Label>
            <input
              value={draft.mediaId}
              onChange={(event) => set({ mediaId: event.target.value })}
              disabled={busy}
              placeholder="17912345678901234"
              className={FIELD}
            />
          </label>

          {problem && (
            <div className="flex items-start gap-2.5">
              <Badge tone="amber">not ready</Badge>
              <p className="text-xs text-white/60 leading-relaxed">{problem}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}

export default function CommentRules({
  rules,
  connectionId,
}: {
  rules: RuleRow[];
  connectionId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (rule: RuleRow) => {
    setBusy(rule.id);
    const result = await setCommentRuleActive(rule.id, !rule.is_active).catch(() => ({
      ok: false as const,
      error: "That could not be changed just now.",
    }));
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error ?? "That could not be changed.");
      return;
    }
    toast.success(result.message ?? "Saved.");
    router.refresh();
  };

  const remove = async (rule: RuleRow) => {
    if (!window.confirm(`Delete "${rule.name}"?`)) return;
    setBusy(rule.id);
    const result = await deleteCommentRule(rule.id).catch(() => ({
      ok: false as const,
      error: "That could not be deleted just now.",
    }));
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error ?? "That could not be deleted.");
      return;
    }
    toast.success(result.message ?? "Deleted.");
    router.refresh();
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="font-semibold">Comment rules</h2>
        <Editor trigger="new" connectionId={connectionId} />
      </div>
      <p className="text-sm text-white/50 mb-5 leading-relaxed">
        Somebody comments on your post, and gets a DM. Instagram allows a private reply for seven
        days after the comment, so they do not have to have messaged you first — which is what
        makes this the one automation worth having on Instagram.
      </p>

      {rules.length === 0 ? (
        <EmptyState
          title="No rules yet"
          description="Write one and the next comment that matches gets an answer."
        />
      ) : (
        <div className="divide-y divide-white/6">
          {rules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center gap-3 py-3.5 first:pt-0">
              <MessageSquare className="w-4 h-4 text-white/25 flex-shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium truncate">{rule.name}</span>
                  {!rule.is_active && <Badge tone="grey">off</Badge>}
                  {rule.media_id && <Badge tone="blue">one post</Badge>}
                </div>
                <div className="text-[12px] text-white/40 mt-0.5 truncate">
                  {rule.keywords.length > 0
                    ? rule.keywords.join(", ")
                    : "every comment"}
                  {" · "}
                  {rule.sent_count === 0
                    ? "not fired yet"
                    : `${rule.sent_count} sent`}
                </div>
              </div>

              <button
                type="button"
                onClick={() => void toggle(rule)}
                disabled={busy === rule.id}
                className="text-xs font-medium text-white/55 hover:text-white disabled:opacity-40 transition-colors"
              >
                {rule.is_active ? "Switch off" : "Switch on"}
              </button>
              <Editor trigger="edit" rule={rule} connectionId={connectionId} />
              <button
                type="button"
                onClick={() => void remove(rule)}
                disabled={busy === rule.id}
                className="text-white/30 hover:text-red-400 disabled:opacity-40 transition-colors"
                aria-label={`Delete ${rule.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
