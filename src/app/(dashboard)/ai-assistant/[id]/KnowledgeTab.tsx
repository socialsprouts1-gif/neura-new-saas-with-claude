"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  Database,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Loader2,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import {
  deleteKnowledgeEntry,
  saveKnowledgeEntry,
  toggleKnowledgeEntry,
} from "@/app/(dashboard)/portal-actions";
import type { AssistantKnowledge, KnowledgeSourceType } from "@/types/portal";
import { SaveForm, SectionCard, Select, TextArea, TextInput } from "./EditorControls";

const SOURCE_META: Record<
  KnowledgeSourceType,
  { label: string; icon: typeof Type; hint: string }
> = {
  text: { label: "Note", icon: Type, hint: "Anything typed straight in — policies, hours, prices." },
  faq: { label: "Q&A", icon: HelpCircle, hint: "A question and its answer, written out." },
  url: { label: "Page", icon: Globe, hint: "Text copied from a page, with the link kept for reference." },
  file: { label: "Document", icon: FileText, hint: "Text pasted out of a PDF, sheet or doc." },
};

export default function KnowledgeTab({
  assistantId,
  entries,
  enabled,
}: {
  assistantId: string;
  entries: AssistantKnowledge[];
  /** Mirrors use_knowledge_base, so the tab can say when nothing is read. */
  enabled: boolean;
}) {
  const [adding, setAdding] = useState(entries.length === 0);
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("text");

  const active = entries.filter((entry) => entry.is_active);
  const characters = active.reduce((total, entry) => total + entry.content.length, 0);

  return (
    <div className="space-y-5">
      {!enabled && (
        <div className="rounded-xl border border-[#FACC15]/25 bg-[#FACC15]/8 p-4">
          <div className="text-sm font-semibold text-[#FACC15] mb-1">
            This assistant is not reading its knowledge base
          </div>
          <p className="text-xs text-white/50 leading-relaxed">
            Entries are stored, but nothing here reaches the model. Turn on “Use knowledge base”
            on the Agent Rules tab.
          </p>
        </div>
      )}

      <SectionCard
        title="Knowledge Base"
        description="The facts this assistant is allowed to answer from. Everything else it will say it needs to check."
        icon={<Database className="w-4.5 h-4.5" />}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/45 mb-5">
          <span>
            <span className="text-white/80 font-semibold tabular-nums">{active.length}</span> active
            {entries.length !== active.length && ` of ${entries.length}`}
          </span>
          <span>
            <span className="text-white/80 font-semibold tabular-nums">
              {characters.toLocaleString()}
            </span>{" "}
            characters
          </span>
          <button
            type="button"
            onClick={() => setAdding((current) => !current)}
            className="ml-auto btn-secondary text-xs py-2 px-3.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {adding ? "Close" : "Add entry"}
          </button>
        </div>

        {adding && (
          <div className="rounded-xl border border-white/10 bg-white/3 p-4 mb-5">
            <SaveForm action={saveKnowledgeEntry} label="Add to knowledge base">
              <input type="hidden" name="assistant_id" value={assistantId} />

              <div className="grid md:grid-cols-2 gap-4">
                <TextInput
                  label="Title"
                  name="title"
                  placeholder="Refund policy"
                  required
                  hint="The assistant sees this as the heading above the content."
                />
                <Select
                  label="Type"
                  name="source_type"
                  value={sourceType}
                  onChange={(event) =>
                    setSourceType(event.target.value as KnowledgeSourceType)
                  }
                  options={(
                    Object.keys(SOURCE_META) as KnowledgeSourceType[]
                  ).map((key) => ({ value: key, label: SOURCE_META[key].label }))}
                  hint={SOURCE_META[sourceType].hint}
                />
              </div>

              {(sourceType === "url" || sourceType === "file") && (
                <div className="mt-4">
                  <TextInput
                    label="Source link"
                    name="source_url"
                    type="url"
                    placeholder="https://yourshop.com/returns"
                    hint="Optional. Kept so you know where the text came from — the assistant does not open it."
                  />
                </div>
              )}

              <div className="mt-4">
                <TextArea
                  label="Content"
                  name="content"
                  rows={7}
                  required
                  placeholder={
                    sourceType === "faq"
                      ? "Q: How long do refunds take?\nA: Five to seven working days from when we receive the item."
                      : "Paste the text the assistant should know. Plain sentences work better than bullet fragments."
                  }
                  hint="Paste the text itself — the assistant reads what is stored here, it never browses the web."
                />
              </div>
            </SaveForm>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-white/45 py-6 text-center">
            Nothing here yet. Without knowledge the assistant answers from its instructions alone,
            and will say it needs to check anything specific to your business.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <KnowledgeRow key={entry.id} entry={entry} assistantId={assistantId} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function KnowledgeRow({
  entry,
  assistantId,
}: {
  entry: AssistantKnowledge;
  assistantId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const meta = SOURCE_META[entry.source_type] ?? SOURCE_META.text;
  const Icon = meta.icon;

  const run = (action: (data: FormData) => Promise<{ ok: boolean; error?: string }>) => {
    const data = new FormData();
    data.set("id", entry.id);
    data.set("assistant_id", assistantId);
    data.set("is_active", String(entry.is_active));
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) setError(result.error ?? "That didn't work.");
    });
  };

  return (
    <li
      className={`rounded-xl border transition-colors ${
        entry.is_active ? "border-white/10 bg-white/3" : "border-white/8 bg-white/[0.015] opacity-60"
      }`}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div className="w-8 h-8 rounded-lg bg-white/5 grid place-items-center flex-shrink-0 text-white/50">
          <Icon className="w-4 h-4" />
        </div>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{entry.title}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </div>
          <div className="text-[11px] text-white/40 mt-0.5">
            {meta.label} · {entry.content.length.toLocaleString()} characters
            {entry.assistant_id === null && " · shared with every assistant"}
          </div>
          {!open && (
            <p className="text-[11px] text-white/35 mt-1 line-clamp-1">{entry.content}</p>
          )}
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {pending && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40" />}
          <button
            type="button"
            onClick={() => run(toggleKnowledgeEntry)}
            disabled={pending}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-white/12 text-white/55 hover:text-white hover:border-white/25 transition-colors disabled:opacity-50"
          >
            {entry.is_active ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            onClick={() => run(deleteKnowledgeEntry)}
            disabled={pending}
            aria-label={`Delete ${entry.title}`}
            className="p-1.5 rounded-lg text-white/35 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="px-3.5 pb-3.5 -mt-1">
          <pre className="text-[11px] text-white/60 whitespace-pre-wrap leading-relaxed bg-white/3 border border-white/8 rounded-lg p-3 max-h-72 overflow-y-auto font-sans">
            {entry.content}
          </pre>
          {entry.source_url && (
            <a
              href={entry.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-accent2-ink hover:underline inline-flex items-center gap-1 mt-2"
            >
              {entry.source_url}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 px-3.5 pb-3" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
