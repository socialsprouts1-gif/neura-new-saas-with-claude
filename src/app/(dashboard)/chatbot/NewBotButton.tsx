"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createFlow } from "../portal-actions";

// Creating a bot navigates straight into the canvas — a list row for an
// empty bot is a dead end, and the first thing anyone wants to do is build.
export default function NewBotButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        type="button"
        disabled={pending}
        className="btn-primary text-sm disabled:opacity-50"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await createFlow();
            if (result.ok && result.id) {
              router.push(`/chatbot/${result.id}`);
            } else {
              setError(result.error ?? "Could not create the bot.");
            }
          })
        }
      >
        <Plus className="w-4 h-4" />
        {pending ? "Creating…" : "New bot"}
      </button>
    </div>
  );
}
