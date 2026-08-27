import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { decryptToken } from "@/lib/crypto";
import { providerById, type ProviderId } from "@/lib/ai-providers";
import { isWithinWorkingHours } from "@/lib/working-hours";
import type { AiAssistant, AssistantKnowledge } from "@/types/portal";

// The AI Assistant reply path. Everything else in the runner answers from
// rules the customer wrote; this is the fallback that answers anything
// else, in the assistant's configured voice, through whichever provider
// the tenant chose and paid for.

// WhatsApp rejects a text body over 4096 characters. Cap generation well
// under it rather than truncating mid-sentence at send time.
export const WHATSAPP_TEXT_LIMIT = 4096;

// A hung provider must not hold the WhatsApp webhook open — Meta retries a
// delivery it doesn't get a 200 for, which would double-send the reply.
const REQUEST_TIMEOUT_MS = 30_000;

// How much reference material may ride along with a reply. Beyond this the
// prompt costs more than the answer is worth, and the model starts skimming.
const KNOWLEDGE_BUDGET_CHARS = 12_000;

export interface AssistantTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantContext {
  assistant: AiAssistant;
  orgName: string;
  contactName?: string | null;
  /** Oldest first. The incoming message must be the last entry. */
  history: AssistantTurn[];
  /** Active entries only. Ignored when use_knowledge_base is off. */
  knowledge?: AssistantKnowledge[];
  /** Injectable for tests; defaults to now. */
  now?: Date;
}

export type AssistantReply =
  /** Send this. */
  | { status: "replied"; text: string }
  /** Deliberately silent — off duty, nothing to reply to. Not an error. */
  | { status: "skipped"; reason: string }
  /** Something broke. The reason names the fix. */
  | { status: "failed"; error: string };

/**
 * The key this assistant will actually authenticate with: the tenant's own
 * pasted key first, then the platform's env key for that provider.
 *
 * Returns null when neither exists, so the caller can say which one to set
 * instead of letting the provider answer with a bare 401.
 */
function resolveApiKey(assistant: AiAssistant): string | null {
  if (assistant.api_key_encrypted) {
    try {
      const key = decryptToken(assistant.api_key_encrypted).trim();
      if (key) return key;
    } catch (error) {
      // A key encrypted under a previous TOKEN_ENCRYPTION_KEY can't be read
      // back. Fall through to the env key rather than failing outright.
      console.error("Could not decrypt the assistant's stored API key", error);
    }
  }

  const envVar = providerById(assistant.provider)?.envVar;
  const fromEnv = envVar ? process.env[envVar]?.trim() : undefined;
  return fromEnv || null;
}

/** Whether this assistant has a key to call its provider with. */
export function isAssistantConfigured(assistant?: AiAssistant): boolean {
  if (!assistant) return Boolean(process.env.ANTHROPIC_API_KEY);
  return resolveApiKey(assistant) !== null;
}

function buildSystemPrompt({
  assistant,
  orgName,
  contactName,
  knowledge,
}: AssistantContext): string {
  const parts = [
    `You are ${assistant.name}, the ${assistant.role} for ${orgName}.`,
    "You are replying inside a WhatsApp conversation with a real customer.",
  ];

  if (assistant.system_prompt.trim()) {
    parts.push("", "Instructions from the business:", assistant.system_prompt.trim());
  }

  if (contactName) {
    parts.push("", `The customer's name is ${contactName}.`);
  }

  const reference = assistant.use_knowledge_base ? formatKnowledge(knowledge ?? []) : "";
  if (reference) {
    parts.push(
      "",
      "Reference information you may use. Treat it as the only source of fact about this business:",
      reference
    );
  }

  parts.push(
    "",
    "How to write:",
    "- Keep replies short — two or three sentences is usually right. This is a chat, not an email.",
    "- Plain text only. WhatsApp does not render markdown, so no headings, bullets, tables or code fences.",
    "- Answer in the language the customer wrote in.",
    "- Never invent prices, stock, order status, delivery dates or policies. If you were not told it, say you will check with the team.",
    "- Do not claim to have performed an action you cannot perform, such as placing an order or issuing a refund.",
    "- If the customer needs a human, say a team member will follow up rather than guessing."
  );

  return parts.join("\n");
}

/**
 * Knowledge entries as one block, newest-first until the budget runs out.
 * Truncation is per-entry so a single long document can't crowd out every
 * other entry entirely.
 */
function formatKnowledge(entries: AssistantKnowledge[]): string {
  const usable = entries.filter((entry) => entry.is_active && entry.content.trim());
  if (usable.length === 0) return "";

  const perEntry = Math.max(400, Math.floor(KNOWLEDGE_BUDGET_CHARS / usable.length));
  const blocks: string[] = [];
  let used = 0;

  for (const entry of usable) {
    if (used >= KNOWLEDGE_BUDGET_CHARS) break;
    const content = entry.content.trim().slice(0, perEntry);
    const block = `### ${entry.title}\n${content}`;
    blocks.push(block);
    used += block.length;
  }

  return blocks.join("\n\n");
}

/**
 * Generates one reply for an inbound message.
 *
 * Never throws: a failed generation should log a bot_run and leave the
 * message for a human, not break webhook processing.
 */
export async function generateAssistantReply(
  context: AssistantContext
): Promise<AssistantReply> {
  const { assistant } = context;

  if (!isWithinWorkingHours(assistant, context.now ?? new Date())) {
    const message = assistant.off_hours_message.trim();
    return message
      ? { status: "replied", text: message.slice(0, WHATSAPP_TEXT_LIMIT) }
      : { status: "skipped", reason: "Outside the assistant's working hours." };
  }

  // memory_turns 0 means "answer this message with no history at all".
  const depth = Math.max(1, assistant.memory_turns || 1);
  const turns = context.history.slice(-depth).filter((turn) => turn.text.trim());
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return { status: "skipped", reason: "No inbound message to reply to." };
  }

  const provider = providerById(assistant.provider);
  if (!provider) {
    return {
      status: "failed",
      error: `"${assistant.provider}" is not a provider this assistant can use. Pick one on the AI Assistant screen.`,
    };
  }

  const apiKey = resolveApiKey(assistant);
  if (!apiKey) {
    return {
      status: "failed",
      error: provider.envVar
        ? `No ${provider.name} API key. Paste one on the assistant's AI Configuration tab, or set ${provider.envVar} in the environment.`
        : `No API key for this endpoint. Paste one on the assistant's AI Configuration tab.`,
    };
  }

  const request = {
    apiKey,
    model: assistant.model,
    system: buildSystemPrompt(context),
    turns,
    temperature: assistant.temperature,
    maxTokens: assistant.max_tokens,
  };

  try {
    let text: string;
    switch (provider.id as ProviderId) {
      case "anthropic":
        text = await callAnthropic(request);
        break;
      case "google":
        text = await callGoogle(request);
        break;
      case "custom": {
        const baseUrl = (assistant.api_base_url ?? "").trim().replace(/\/+$/, "");
        if (!baseUrl) {
          return {
            status: "failed",
            error:
              "This assistant uses a custom endpoint but no base URL is set. Add one on the AI Configuration tab, e.g. https://openrouter.ai/api/v1",
          };
        }
        text = await callOpenAiCompatible({ ...request, baseUrl, tokenParam: "max_tokens" });
        break;
      }
      case "openai":
      default:
        text = await callOpenAiCompatible({
          ...request,
          baseUrl: "https://api.openai.com/v1",
          tokenParam: "max_completion_tokens",
        });
        break;
    }

    const trimmed = text.trim();
    if (!trimmed) return { status: "failed", error: "The assistant returned an empty reply." };
    return { status: "replied", text: trimmed.slice(0, WHATSAPP_TEXT_LIMIT) };
  } catch (error) {
    // Surface the provider's own message: "invalid api key" and "credit
    // balance too low" need different fixes, and a generic string hides
    // which one it was.
    const message =
      error instanceof Anthropic.APIError
        ? `${provider.name} API error (${error.status}): ${error.message}`
        : error instanceof Error
          ? error.message
          : `Unknown error calling ${provider.name}`;
    console.error("AI assistant generation failed", error);
    return { status: "failed", error: message };
  }
}

// --- providers ------------------------------------------------------------

interface ProviderRequest {
  apiKey: string;
  model: string;
  system: string;
  turns: AssistantTurn[];
  temperature: number;
  maxTokens: number;
}

async function callAnthropic({
  apiKey,
  model,
  system,
  turns,
  temperature,
  maxTokens,
}: ProviderRequest): Promise<string> {
  const client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    // Deliberately no extended thinking. A support reply is not a
    // reasoning task, the latency is visible to the customer waiting in
    // WhatsApp, and thinking pins temperature to 1 — which would make
    // the temperature slider on the AI Assistant screen a lie.
    temperature,
    system,
    messages: turns.map((turn) => ({ role: turn.role, content: turn.text })),
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/**
 * OpenAI and anything that speaks its chat-completions shape.
 *
 * `tokenParam` differs because OpenAI renamed max_tokens to
 * max_completion_tokens, while most compatible servers (Groq, Together,
 * Ollama, OpenRouter) still only know the original name.
 */
async function callOpenAiCompatible({
  apiKey,
  model,
  system,
  turns,
  temperature,
  maxTokens,
  baseUrl,
  tokenParam,
}: ProviderRequest & { baseUrl: string; tokenParam: "max_tokens" | "max_completion_tokens" }) {
  const body: Record<string, unknown> = {
    model,
    [tokenParam]: maxTokens,
    messages: [
      { role: "system", content: system },
      ...turns.map((turn) => ({ role: turn.role, content: turn.text })),
    ],
  };

  // The reasoning models reject any temperature but the default, and a 400
  // here reads to the tenant as "my key is broken". Just don't send it.
  if (!isFixedTemperatureModel(model)) body.temperature = temperature;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const payload = await readJson(response);
  if (!response.ok) throw new Error(describeProviderError("OpenAI", response.status, payload));

  const choice = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  // Some compatible servers return the content as an array of parts.
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "object" && part && "text" in part ? String(part.text) : ""))
      .join("");
  }
  return "";
}

function isFixedTemperatureModel(model: string): boolean {
  return /^(gpt-5|o[1-9])/i.test(model.trim());
}

async function callGoogle({
  apiKey,
  model,
  system,
  turns,
  temperature,
  maxTokens,
}: ProviderRequest): Promise<string> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Header rather than ?key=, so the key never lands in a proxy or
      // access log alongside the URL.
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.text }],
      })),
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const payload = await readJson(response);
  if (!response.ok) throw new Error(describeProviderError("Google AI", response.status, payload));

  const data = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };

  const blocked = data.promptFeedback?.blockReason;
  if (blocked) {
    throw new Error(`Google AI blocked this conversation (${blocked}) and returned no reply.`);
  }

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") {
    throw new Error("Google AI stopped the reply on a safety filter.");
  }

  return (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("");
}

async function readJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  try {
    return JSON.parse(raw);
  } catch {
    // A gateway or a wrong base URL answers with HTML. Keep enough of it to
    // recognise, not enough to fill the bot_runs table.
    return { error: { message: raw.slice(0, 300) } };
  }
}

function describeProviderError(name: string, status: number, payload: unknown): string {
  const message = (payload as { error?: { message?: unknown } })?.error?.message;
  const detail = typeof message === "string" && message.trim() ? message.trim() : "no detail";
  if (status === 401 || status === 403) {
    return `${name} rejected the API key (${status}): ${detail}. Check the key on the assistant's AI Configuration tab.`;
  }
  if (status === 404) {
    return `${name} does not have a model named for this assistant (${status}): ${detail}.`;
  }
  if (status === 429) {
    return `${name} rate-limited or out of credit (429): ${detail}.`;
  }
  return `${name} API error (${status}): ${detail}`;
}
