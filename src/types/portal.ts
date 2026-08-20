// Types for the portal modules
// (supabase/migrations/20260820180000_portal_modules.sql).
//
// Declared as type aliases rather than interfaces: supabase-js constrains
// table Row/Insert/Update to Record<string, unknown>, and an interface has
// no implicit index signature, which silently degrades every query on the
// table to `never`.

export type AiAssistant = {
  id: string;
  org_id: string;
  name: string;
  role: string;
  model: string;
  system_prompt: string;
  temperature: number;
  handoff_keywords: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ChatbotTrigger = "keyword" | "welcome" | "fallback" | "menu" | "business_hours";

export type ChatbotNode = {
  id: string;
  type: string;
  body: string;
  buttons?: string[];
  next?: string | null;
};

export type ChatbotFlow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  trigger_type: ChatbotTrigger;
  trigger_value: string | null;
  nodes: ChatbotNode[];
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

export type FaqEntry = {
  id: string;
  org_id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string | null;
  hit_count: number;
  is_active: boolean;
  created_at: string;
};

export type ReminderStatus = "pending" | "sent" | "cancelled" | "failed";

export type Reminder = {
  id: string;
  org_id: string;
  contact_id: string | null;
  created_by: string | null;
  title: string;
  body: string | null;
  remind_at: string;
  status: ReminderStatus;
  created_at: string;
};

export type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";

export type OrgIntegration = {
  id: string;
  org_id: string;
  provider: string;
  status: IntegrationStatus;
  credentials_encrypted: string | null;
  config: Record<string, string>;
  last_error: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiKey = {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type OutgoingWebhook = {
  id: string;
  org_id: string;
  name: string;
  target_url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  created_at: string;
};

export type WebhookDelivery = {
  id: string;
  webhook_id: string;
  org_id: string;
  event: string;
  status_code: number | null;
  error: string | null;
  created_at: string;
};

export type MediaAsset = {
  id: string;
  org_id: string;
  name: string;
  url: string;
  media_type: "image" | "video" | "document" | "audio";
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  org_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  stock: number | null;
  is_active: boolean;
  created_at: string;
};

// Models offered when creating an AI assistant. Kept here so the option list
// and the stored value can never drift apart.
export const ASSISTANT_MODELS = [
  { value: "claude-opus-5", label: "Claude Opus 5 — most capable" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5 — balanced" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fastest" },
] as const;
