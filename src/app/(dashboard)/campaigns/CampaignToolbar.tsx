"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Play, Plus, Trash2 } from "lucide-react";
import { deleteCampaign, setCampaignStatus } from "@/app/(dashboard)/campaign-actions";
import CampaignBuilder, { type TemplateOption } from "./CampaignBuilder";

export function NewCampaignButton({
  templates,
  tags,
  groups,
}: {
  templates: TemplateOption[];
  tags: string[];
  groups: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary text-sm">
        <Plus className="w-4 h-4" />
        New campaign
      </button>
      {open && (
        <CampaignBuilder
          templates={templates}
          tags={tags}
          groups={groups}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Cancel stops only what has not gone out yet; there is no unsend, so the
 * button says cancel rather than stop and the row keeps its sent count.
 */
export function CampaignRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (task: () => Promise<unknown>) =>
    startTransition(async () => {
      await task();
      router.refresh();
    });

  const live = status === "running" || status === "scheduled";

  return (
    <span className="inline-flex items-center gap-1">
      {live ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setCampaignStatus(id, "cancelled"))}
          aria-label="Cancel campaign"
          className="p-1.5 rounded-lg text-white/30 hover:text-[#FACC15] hover:bg-white/8 transition-colors"
        >
          <Ban className="w-3.5 h-3.5" />
        </button>
      ) : status === "cancelled" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setCampaignStatus(id, "running"))}
          aria-label="Resume campaign"
          className="p-1.5 rounded-lg text-white/30 hover:text-accent-ink hover:bg-white/8 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(() => {
            const data = new FormData();
            data.set("id", id);
            return deleteCampaign(data);
          })
        }
        aria-label="Delete campaign"
        className="p-1.5 rounded-lg text-white/30 hover:text-[#F87171] hover:bg-white/8 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}
