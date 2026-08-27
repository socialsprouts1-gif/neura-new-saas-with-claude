"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createAiAssistant } from "../portal-actions";
import { PROMPT_PRESETS, PROVIDERS } from "@/lib/ai-providers";

// Creation asks the two questions that decide what the editor opens with —
// who the assistant is, and whose API it calls. Everything else is edited
// on the assistant's own page, where there is room to explain it.
export default function NewAssistantPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState(PROMPT_PRESETS[0].id);
  const [provider, setProvider] = useState<string>("anthropic");
  const [name, setName] = useState("");

  const submit = () => {
    setError(null);
    const data = new FormData();
    data.set("name", name);
    data.set("prompt_preset", preset);
    data.set("provider", provider);

    startTransition(async () => {
      const result = await createAiAssistant(data);
      if (!result.ok || !result.id) {
        setError(result.error ?? "Could not create the assistant.");
        return;
      }
      // Straight into the editor — the row on its own does nothing yet.
      router.push(`/ai-assistant/${result.id}`);
    });
  };

  return (
    <div className="glass-card p-6">
      <h2 className="font-semibold mb-1">New assistant</h2>
      <p className="text-sm text-white/50 mb-5">
        Pick a starting role and a provider. You can change both later.
      </p>

      <label className="block mb-4">
        <span className="block text-xs font-medium text-white/70 mb-1.5">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) submit();
          }}
          placeholder="Support Sam"
          className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all"
        />
      </label>

      <div className="mb-4">
        <span className="block text-xs font-medium text-white/70 mb-2">Starting role</span>
        <div className="space-y-1.5">
          {PROMPT_PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPreset(option.id)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors ${
                preset === option.id
                  ? "border-accent/50 bg-accent/8"
                  : "border-white/10 bg-white/3 hover:border-white/20"
              }`}
            >
              <div className="text-sm font-medium">{option.label}</div>
              <div className="text-[11px] text-white/45 mt-0.5">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <span className="block text-xs font-medium text-white/70 mb-2">Provider</span>
        <div className="grid grid-cols-2 gap-1.5">
          {PROVIDERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setProvider(option.id)}
              className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                provider === option.id
                  ? "border-accent/50 bg-accent/8 text-accent-ink"
                  : "border-white/10 bg-white/3 text-white/60 hover:border-white/20"
              }`}
            >
              {option.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 mb-3" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !name.trim()}
        className="btn-primary w-full justify-center disabled:opacity-50"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {pending ? "Creating…" : "Create assistant"}
      </button>
    </div>
  );
}
