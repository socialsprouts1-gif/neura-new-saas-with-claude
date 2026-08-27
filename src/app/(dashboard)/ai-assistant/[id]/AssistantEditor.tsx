"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Loader2, Settings2, SlidersHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteAiAssistant, toggleAiAssistant } from "@/app/(dashboard)/portal-actions";
import { providerById } from "@/lib/ai-providers";
import type { AiAssistant, AssistantKnowledge } from "@/types/portal";
import SettingsTab from "./SettingsTab";
import KnowledgeTab from "./KnowledgeTab";
import RulesTab from "./RulesTab";

const TABS = [
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "knowledge", label: "Knowledge Base", icon: Database },
  { id: "rules", label: "Agent Rules", icon: SlidersHorizontal },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AssistantEditor({
  assistant,
  knowledge,
  hasKey,
}: {
  assistant: AiAssistant;
  knowledge: AssistantKnowledge[];
  /** Resolved on the server: an own key, or a platform key for this provider. */
  hasKey: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("settings");
  const [pending, startTransition] = useTransition();

  const provider = providerById(assistant.provider);

  const toggle = () => {
    const data = new FormData();
    data.set("id", assistant.id);
    data.set("is_active", String(assistant.is_active));
    startTransition(async () => {
      await toggleAiAssistant(data);
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirm(`Delete ${assistant.name}? Its knowledge base entries go with it.`)) return;
    const data = new FormData();
    data.set("id", assistant.id);
    startTransition(async () => {
      const result = await deleteAiAssistant(data);
      if (result.ok) router.push("/ai-assistant");
    });
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <Link
        href="/ai-assistant"
        className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white/70 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All assistants
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{assistant.name}</h1>
          <p className="text-sm text-white/50 mt-1">
            {assistant.role} · {provider?.name ?? assistant.provider} ·{" "}
            <code className="text-accent2-ink">{assistant.model}</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
              assistant.is_active
                ? "border border-white/15 text-white/70 hover:text-white hover:border-white/30"
                : "bg-accent text-[#050508] hover:bg-[var(--accent-strong)]"
            }`}
          >
            {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {assistant.is_active ? "Pause assistant" : "Set live"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="Delete this assistant"
            className="p-2.5 rounded-xl border border-white/12 text-white/40 hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* The two states that make an assistant look fine and answer nothing. */}
      {!hasKey && (
        <div className="rounded-xl border border-[#F87171]/25 bg-[#F87171]/8 p-4 mb-5">
          <div className="text-sm font-semibold text-[#F87171] mb-1">
            No API key for {provider?.name ?? assistant.provider}
          </div>
          <p className="text-xs text-white/50 leading-relaxed">
            This assistant is saved but cannot generate a single reply. Paste a key under AI
            Configuration below
            {provider?.envVar ? `, or set ${provider.envVar} in the environment.` : "."}
          </p>
        </div>
      )}
      {hasKey && !assistant.is_active && (
        <div className="rounded-xl border border-white/12 bg-white/4 p-4 mb-5">
          <div className="text-sm font-semibold mb-1">Paused</div>
          <p className="text-xs text-white/50 leading-relaxed">
            Ready to go, but not answering anything yet. Press “Set live” when the prompt reads the
            way you want it to.
          </p>
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/8 mb-5 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === id ? "bg-accent text-[#050508]" : "text-white/55 hover:text-white/85"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {id === "knowledge" && knowledge.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  tab === id ? "bg-black/15" : "bg-white/8 text-white/50"
                }`}
              >
                {knowledge.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "settings" && <SettingsTab assistant={assistant} />}
      {tab === "knowledge" && (
        <KnowledgeTab
          assistantId={assistant.id}
          entries={knowledge}
          enabled={assistant.use_knowledge_base}
        />
      )}
      {tab === "rules" && <RulesTab assistant={assistant} />}
    </div>
  );
}
