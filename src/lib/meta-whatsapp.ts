import "server-only";

// Pin the Graph API version in one place — every call goes through
// META_GRAPH_BASE_URL rather than hardcoding "v21.0" per call site.
export const META_API_VERSION = "v21.0";
export const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export class MetaApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`Meta Graph API error (${status}): ${JSON.stringify(body)}`);
    this.name = "MetaApiError";
    this.status = status;
    this.body = body;
  }
}

export interface MetaTemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: "quick_reply" | "url" | "catalog" | "flow";
  index?: number;
  parameters?: Array<Record<string, unknown>>;
}

export interface MetaReplyButton {
  id: string;
  title: string;
}

export interface MetaSendMessageResponse {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface MetaMediaResponse {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
}

async function postToMessagesEndpoint(
  phoneNumberId: string,
  accessToken: string,
  payload: Record<string, unknown>
): Promise<MetaSendMessageResponse> {
  const response = await fetch(`${META_GRAPH_BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new MetaApiError(response.status, data);
  }
  return data as MetaSendMessageResponse;
}

export function sendTextMessage(
  phoneNumberId: string,
  to: string,
  body: string,
  accessToken: string
): Promise<MetaSendMessageResponse> {
  return postToMessagesEndpoint(phoneNumberId, accessToken, {
    to,
    type: "text",
    text: { body },
  });
}

export function sendTemplateMessage(
  phoneNumberId: string,
  to: string,
  templateName: string,
  language: string,
  components: MetaTemplateComponent[],
  accessToken: string
): Promise<MetaSendMessageResponse> {
  return postToMessagesEndpoint(phoneNumberId, accessToken, {
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components,
    },
  });
}

// Interactive reply buttons — what a chatbot flow node with choices
// renders as. Meta caps this at 3 buttons with 20-character titles and
// rejects the whole message if either is exceeded, so both are enforced
// here rather than discovered as a 400 at runtime.
export const MAX_REPLY_BUTTONS = 3;
export const MAX_BUTTON_TITLE_LENGTH = 20;

export function sendInteractiveButtons(
  phoneNumberId: string,
  to: string,
  body: string,
  buttons: MetaReplyButton[],
  accessToken: string
): Promise<MetaSendMessageResponse> {
  return postToMessagesEndpoint(phoneNumberId, accessToken, {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, MAX_REPLY_BUTTONS).map((button) => ({
          type: "reply",
          reply: {
            id: button.id,
            title: button.title.slice(0, MAX_BUTTON_TITLE_LENGTH),
          },
        })),
      },
    },
  });
}

// Resolves a media ID to its short-lived download URL. The URL itself
// still requires the same `Authorization: Bearer` header to fetch.
export async function getMediaUrl(mediaId: string, accessToken: string): Promise<string> {
  const response = await fetch(`${META_GRAPH_BASE_URL}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new MetaApiError(response.status, data);
  }
  return (data as MetaMediaResponse).url;
}
