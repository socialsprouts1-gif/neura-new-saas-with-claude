"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { removeTemplate, syncTemplates } from "@/app/(dashboard)/campaign-actions";
import TemplateBuilder from "./TemplateBuilder";

/**
 * The two things this screen does besides list: submit a new template, and
 * pull Meta's verdict on the ones already submitted.
 *
 * Sync exists because approval is asynchronous and Meta never calls back —
 * without it a template stays "pending" on screen hours after it went live.
 */
export function TemplateToolbar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sync = () =>
    startTransition(async () => {
      const result = await syncTemplates();
      setNote(result.ok ? (result.message ?? "Synced.") : (result.error ?? "Sync failed."));
      router.refresh();
    });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {note && <span className="text-xs text-white/50 mr-1 max-w-xs">{note}</span>}
        <button type="button" onClick={sync} disabled={pending} className="btn-secondary text-sm">
          {pending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Sync with Meta
        </button>
        <button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          Create template
        </button>
      </div>

      {open && <TemplateBuilder onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Deleting removes the template at Meta too, so it is confirmed rather than
 * one click — the name cannot be reused for 30 days afterwards.
 */
export function DeleteTemplateButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const data = new FormData();
              data.set("id", id);
              await removeTemplate(data);
              router.refresh();
            })
          }
          className="text-[11px] px-2 py-1 rounded-lg bg-[#F87171]/12 text-[#F87171] border border-[#F87171]/25"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[11px] px-2 py-1 rounded-lg text-white/45 hover:text-white"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label={`Delete ${name}`}
      className="p-1.5 rounded-lg text-white/30 hover:text-[#F87171] hover:bg-white/8 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
