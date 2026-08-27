"use client";

import { useState } from "react";
import { Cpu, ExternalLink, Eye, EyeOff, Info, KeyRound, MessageSquareText, User } from "lucide-react";
import { saveAssistantSettings, saveAssistantAiConfig } from "@/app/(dashboard)/portal-actions";
import { PROMPT_PRESETS, PROVIDERS, defaultModelFor, providerById } from "@/lib/ai-providers";
import type { ProviderId } from "@/lib/ai-providers";
import type { AiAssistant } from "@/types/portal";
import {
  SaveForm,
  SectionCard,
  Select,
  SliderRow,
  TextArea,
  TextInput,
  Toggle,
} from "./EditorControls";

export default function SettingsTab({ assistant }: { assistant: AiAssistant }) {
  return (
    <div className="space-y-5">
      <BasicInformation assistant={assistant} />
      <AiConfiguration assistant={assistant} />
    </div>
  );
}

// --- Basic information + prompt ------------------------------------------

function BasicInformation({ assistant }: { assistant: AiAssistant }) {
  const [isActive, setIsActive] = useState(assistant.is_active);
  const [mode, setMode] = useState<"predefined" | "custom">(
    assistant.prompt_preset === "custom" ? "custom" : "predefined"
  );
  const [preset, setPreset] = useState(assistant.prompt_preset);
  const [prompt, setPrompt] = useState(assistant.system_prompt);
  const [role, setRole] = useState(assistant.role);

  // Picking a role card replaces the prompt. Editing the text afterwards
  // makes it custom — leaving a card highlighted next to a prompt it no
  // longer matches is the kind of small lie that costs trust.
  const choosePreset = (id: string) => {
    const chosen = PROMPT_PRESETS.find((option) => option.id === id);
    if (!chosen) return;
    setPreset(id);
    setPrompt(chosen.prompt);
    setRole(chosen.role);
  };

  return (
    <>
      <SectionCard
        title="Basic Information"
        description="Who this assistant is, and whether it is answering customers right now."
        icon={<User className="w-4.5 h-4.5" />}
      >
        <SaveForm action={saveAssistantSettings} hint="Applies to every new reply.">
          <input type="hidden" name="id" value={assistant.id} />
          <input type="hidden" name="prompt_preset" value={mode === "custom" ? "custom" : preset} />

          <div className="grid md:grid-cols-2 gap-4">
            <TextInput
              label="Assistant name"
              name="name"
              defaultValue={assistant.name}
              placeholder="Support Sam"
              required
            />
            <TextInput
              label="Role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Support agent"
              hint="Named in the prompt: “You are the … for this business.”"
            />
          </div>

          <div className="mt-4">
            <TextInput
              label="Handoff keywords"
              name="handoff_keywords"
              defaultValue={assistant.handoff_keywords.join(", ")}
              placeholder="human, agent, talk to someone"
              hint="Comma separated. Any of these in a message stops the bot on that chat and flags it for a human."
            />
          </div>

          <div className="mt-2 border-t border-white/8 pt-2">
            <Toggle
              name="is_active"
              checked={isActive}
              onChange={setIsActive}
              label="Assistant is live"
              description="When off it is saved but never replies. Chatbots, FAQ and automations keep working."
            />
          </div>

          {/* Prompt configuration, in the same form so one save covers the
              role card and the text it produced. */}
          <div className="mt-6 pt-6 border-t border-white/8">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 grid place-items-center flex-shrink-0 text-accent-ink">
                <MessageSquareText className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-semibold leading-tight">Prompt Configuration</h3>
                <p className="text-xs text-white/45 mt-1">
                  Start from a role, or write the instructions yourself.
                </p>
              </div>
            </div>

            <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10 mb-4">
              {(["predefined", "custom"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mode === option
                      ? "bg-accent text-[#050508]"
                      : "text-white/55 hover:text-white/80"
                  }`}
                >
                  {option === "predefined" ? "Predefined" : "Custom"}
                </button>
              ))}
            </div>

            {mode === "predefined" && (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5 mb-5">
                {PROMPT_PRESETS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => choosePreset(option.id)}
                    className={`text-left p-3.5 rounded-xl border transition-colors ${
                      preset === option.id
                        ? "border-accent/50 bg-accent/8"
                        : "border-white/10 bg-white/3 hover:border-white/20"
                    }`}
                  >
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-[11px] text-white/45 mt-1 leading-relaxed">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <TextArea
              label="Customize prompt"
              name="system_prompt"
              rows={10}
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                if (mode === "predefined") setMode("custom");
              }}
              placeholder="You are the support agent for a fashion brand. Be warm and concise. Never promise delivery dates. If asked about refunds, hand off to a human."
              hint={`${prompt.length} characters. Editing this makes the prompt custom.`}
            />
          </div>
        </SaveForm>
      </SectionCard>
    </>
  );
}

// --- Provider, model and key ----------------------------------------------

function AiConfiguration({ assistant }: { assistant: AiAssistant }) {
  const [providerId, setProviderId] = useState<ProviderId>(
    (providerById(assistant.provider)?.id ?? "anthropic") as ProviderId
  );
  const [model, setModel] = useState(assistant.model);
  const [temperature, setTemperature] = useState(assistant.temperature);
  const [maxTokens, setMaxTokens] = useState(assistant.max_tokens);
  const [showKey, setShowKey] = useState(false);
  const [removeKey, setRemoveKey] = useState(false);

  const provider = providerById(providerId)!;
  const hasStoredKey = Boolean(assistant.api_key_encrypted);

  const changeProvider = (next: ProviderId) => {
    setProviderId(next);
    // The old model name means nothing to the new provider, so move to that
    // provider's default rather than leaving a name that will 404 at send.
    setModel(defaultModelFor(next));
    setRemoveKey(false);
  };

  return (
    <SectionCard
      title="AI Configuration"
      description="Which API answers your customers, and on whose key."
      icon={<Cpu className="w-4.5 h-4.5" />}
    >
      <SaveForm action={saveAssistantAiConfig} label="Save configuration">
        <input type="hidden" name="id" value={assistant.id} />
        <input type="hidden" name="provider" value={providerId} />
        <input type="hidden" name="remove_api_key" value={String(removeKey)} />

        <span className="block text-xs font-medium text-white/70 mb-2">Provider</span>
        <div className="grid sm:grid-cols-2 gap-2.5 mb-5">
          {PROVIDERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => changeProvider(option.id)}
              className={`text-left p-3.5 rounded-xl border transition-colors ${
                providerId === option.id
                  ? "border-accent/50 bg-accent/8"
                  : "border-white/10 bg-white/3 hover:border-white/20"
              }`}
            >
              <div className="text-sm font-medium">{option.name}</div>
              <div className="text-[11px] text-white/45 mt-1 leading-relaxed">{option.blurb}</div>
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {provider.models.length > 0 ? (
            <Select
              label="Model"
              name="model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              options={provider.models.map((option) => ({
                value: option.value,
                label: `${option.label} — ${option.hint}`,
              }))}
              hint="Every reply on this assistant goes to this model."
            />
          ) : (
            <TextInput
              label="Model"
              name="model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="meta-llama/llama-3.3-70b-instruct"
              hint="Exactly as your endpoint names it."
            />
          )}

          {provider.needsBaseUrl ? (
            <TextInput
              label="Base URL"
              name="api_base_url"
              defaultValue={assistant.api_base_url ?? ""}
              placeholder="https://openrouter.ai/api/v1"
              hint="OpenAI-compatible. We POST to {base}/chat/completions."
            />
          ) : (
            <div className="hidden md:block" />
          )}
        </div>

        {/* API key */}
        <div className="mt-5 rounded-xl border border-white/10 bg-white/3 p-4">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-accent-ink" />
            <span className="text-sm font-medium">{provider.name} API key</span>
            {hasStoredKey && !removeKey && (
              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-accent/10 text-accent-ink border border-accent/20">
                saved
              </span>
            )}
          </div>

          {removeKey ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-white/50 flex-1 min-w-[16rem]">
                The stored key will be deleted when you save.
                {provider.envVar
                  ? ` This assistant will fall back to the platform's ${provider.envVar}.`
                  : " This assistant will stop being able to reply."}
              </p>
              <button
                type="button"
                onClick={() => setRemoveKey(false)}
                className="text-xs text-white/60 hover:text-white underline underline-offset-2"
              >
                Keep it
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  name="api_key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={hasStoredKey ? "•••••••••••• (leave blank to keep)" : provider.keyPlaceholder}
                  className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-2.5 pr-11 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((current) => !current)}
                  aria-label={showKey ? "Hide the API key" : "Show the API key"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
                <a
                  href={provider.consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-accent2-ink hover:underline inline-flex items-center gap-1"
                >
                  Get a key at {provider.consoleLabel}
                  <ExternalLink className="w-3 h-3" />
                </a>
                {hasStoredKey && (
                  <button
                    type="button"
                    onClick={() => setRemoveKey(true)}
                    className="text-[11px] text-red-400 hover:underline"
                  >
                    Remove stored key
                  </button>
                )}
              </div>

              <p className="text-[11px] text-white/35 mt-2.5 leading-relaxed">
                Encrypted before it is stored and never shown again — not to you, not to us.
                {provider.envVar && !hasStoredKey
                  ? ` Leave it blank to use the platform's ${provider.envVar} instead.`
                  : ""}
              </p>
            </>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <SliderRow
            name="temperature"
            label="Creativity"
            value={temperature}
            onChange={setTemperature}
            min={0}
            max={2}
            step={0.1}
            format={(value) => value.toFixed(1)}
            scale={["precise and repeatable", "varied"]}
          />
          <SliderRow
            name="max_tokens"
            label="Maximum reply length"
            value={maxTokens}
            onChange={setMaxTokens}
            min={128}
            max={4096}
            step={64}
            format={(value) => `${value} tokens`}
            scale={["a few lines", "several paragraphs"]}
          />
        </div>

        <p className="text-[11px] text-white/35 mt-5 flex items-start gap-2 leading-relaxed">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
          WhatsApp cuts a text message at 4096 characters, so replies are trimmed to that
          regardless of the limit set here.
        </p>
      </SaveForm>
    </SectionCard>
  );
}
