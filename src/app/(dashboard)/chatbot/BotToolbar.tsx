"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Sparkles } from "lucide-react";
import { createFlow, createStarterFlow, importFlow } from "../portal-actions";

// Three ways to get a bot, in ascending order of how much you have to do:
// import one you already have, start from a working example, or build from
// scratch. Creating navigates straight into the canvas — a list row for an
// empty bot is a dead end, and the first thing anyone wants to do is build.

export default function BotToolbar() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (work: () => Promise<{ ok: boolean; id?: string; error?: string; message?: string }>) =>
    startTransition(async () => {
      setMessage(null);
      const result = await work();
      if (result.ok && result.id) {
        router.push(`/chatbot/${result.id}`);
        return;
      }
      setMessage({ ok: result.ok, text: result.error ?? result.message ?? "Something went wrong." });
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {message && (
        <span className={`text-xs mr-1 ${message.ok ? "text-accent-ink" : "text-red-400"}`}>
          {message.text}
        </span>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          // Reset immediately so picking the same file twice still fires.
          event.target.value = "";
          if (!file) return;
          const text = await file.text();
          run(() => importFlow(text));
        }}
      />

      <button
        type="button"
        disabled={pending}
        onClick={() => run(createStarterFlow)}
        className="btn-secondary text-sm disabled:opacity-50"
        title="Creates a working keyword bot with buttons and a handoff, as a draft"
      >
        <Sparkles className="w-4 h-4" />
        Example bot
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => fileInput.current?.click()}
        className="btn-secondary text-sm disabled:opacity-50"
        title="Import a bot exported from this builder"
      >
        <Upload className="w-4 h-4" />
        Import
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => run(createFlow)}
        className="btn-primary text-sm disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        {pending ? "Working…" : "Create bot"}
      </button>
    </div>
  );
}
