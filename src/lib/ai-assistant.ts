import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { AiAssistant } from "@/types/portal";

// The AI Assistant reply path. Everything else in the runner answers from
// rules the customer wrote; this is the fallback that answers anything
// else, in the assistant's configured voice.

// WhatsApp rejects a text body over 4096 characters. Cap generation well
// under it rather than truncating mid-sentence at send time.
const MAX_TOKENS = 1024;
export const WHATSAPP_TEXT_LIMIT = 4096;

// How much of the thread to send back as context. Deep enough that the
// assistant follows a conversation, shallow enough that a months-old
// thread does not turn every reply into a large prompt.
const HISTORY_LIMIT = 20;

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
}

export type AssistantReply =
  | { ok: true; text: string }
  | { ok: false; error: string };

export function isAssistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function buildSystemPrompt({ assistant, orgName, contactName }: AssistantContext): string {
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
 * Generates one reply for an inbound message.
 *
 * Returns an error rather than throwing: a failed generation should log a
 * bot_run and leave the message for a human, not break webhook processing.
 */
export async function generateAssistantReply(context: AssistantContext): Promise<AssistantReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "ANTHROPIC_API_KEY is not set — the AI assistant cannot generate replies.",
    };
  }

  const turns = context.history.slice(-HISTORY_LIMIT).filter((turn) => turn.text.trim());
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return { ok: false, error: "No inbound message to reply to." };
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: context.assistant.model,
      max_tokens: MAX_TOKENS,
      // Deliberately no extended thinking. A support reply is not a
      // reasoning task, the latency is visible to the customer waiting in
      // WhatsApp, and thinking pins temperature to 1 — which would make
      // the temperature slider on the AI Assistant screen a lie.
      temperature: context.assistant.temperature,
      system: buildSystemPrompt(context),
      messages: turns.map((turn) => ({
        role: turn.role,
        content: turn.text,
      })),
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      return { ok: false, error: "The assistant returned an empty reply." };
    }

    return { ok: true, text: text.slice(0, WHATSAPP_TEXT_LIMIT) };
  } catch (error) {
    // Surface the API's own message: "invalid x-api-key" and "credit
    // balance too low" need different fixes, and a generic string hides
    // which one it was.
    const message =
      error instanceof Anthropic.APIError
        ? `Claude API error (${error.status}): ${error.message}`
        : error instanceof Error
          ? error.message
          : "Unknown error generating the assistant reply";
    console.error("AI assistant generation failed", error);
    return { ok: false, error: message };
  }
}
