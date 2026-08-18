// Hand-written to match supabase/migrations/*.sql. Regenerate with
// `supabase gen types typescript` once a live project exists, and reconcile
// any drift against these migrations.
//
// Every table includes `Relationships: []` and the schema includes empty
// `Views`/`Functions` because @supabase/supabase-js's client generic only
// resolves table types when the schema structurally satisfies its
// GenericSchema constraint — omitting these makes every `.from(...)` call
// silently type as `never` instead of erroring.

export type OrgRole = "owner" | "admin" | "member";
export type WabaStatus = "pending" | "active" | "disabled" | "error";
export type ConversationStatus = "open" | "pending" | "resolved" | "closed";
export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "sent" | "delivered" | "read" | "failed";
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type TemplateStatus = "draft" | "pending" | "approved" | "rejected" | "disabled";
export type CampaignStatus = "draft" | "scheduled" | "running" | "completed" | "cancelled" | "failed";
export type CampaignRecipientStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      org_members: {
        Row: { org_id: string; user_id: string; role: OrgRole; created_at: string };
        Insert: { org_id: string; user_id: string; role?: OrgRole; created_at?: string };
        Update: { org_id?: string; user_id?: string; role?: OrgRole; created_at?: string };
        Relationships: [];
      };
      waba_connections: {
        Row: {
          id: string;
          org_id: string;
          waba_id: string;
          phone_number_id: string;
          meta_app_id: string;
          access_token_encrypted: string;
          webhook_verify_token: string;
          status: WabaStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          waba_id: string;
          phone_number_id: string;
          meta_app_id: string;
          access_token_encrypted: string;
          webhook_verify_token: string;
          status?: WabaStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["waba_connections"]["Insert"]>;
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          org_id: string;
          wa_id: string;
          name: string | null;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          wa_id: string;
          name?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          org_id: string;
          contact_id: string;
          last_message_at: string | null;
          status: ConversationStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          contact_id: string;
          last_message_at?: string | null;
          status?: ConversationStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          org_id: string;
          direction: MessageDirection;
          type: string;
          content: Record<string, unknown>;
          wa_message_id: string | null;
          status: MessageStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          org_id?: string;
          direction: MessageDirection;
          type: string;
          content?: Record<string, unknown>;
          wa_message_id?: string | null;
          status?: MessageStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      message_templates: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          category: TemplateCategory;
          status: TemplateStatus;
          language: string;
          components_json: unknown[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          category?: TemplateCategory;
          status?: TemplateStatus;
          language?: string;
          components_json?: unknown[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["message_templates"]["Insert"]>;
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          org_id: string;
          template_id: string | null;
          segment_filter: Record<string, unknown>;
          status: CampaignStatus;
          scheduled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          template_id?: string | null;
          segment_filter?: Record<string, unknown>;
          status?: CampaignStatus;
          scheduled_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
        Relationships: [];
      };
      campaign_recipients: {
        Row: {
          id: string;
          campaign_id: string;
          org_id: string;
          contact_id: string;
          status: CampaignRecipientStatus;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          org_id?: string;
          contact_id: string;
          status?: CampaignRecipientStatus;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["campaign_recipients"]["Insert"]>;
        Relationships: [];
      };
      automation_flows: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          trigger_type: string;
          trigger_config: Record<string, unknown>;
          actions_json: unknown[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          trigger_type: string;
          trigger_config?: Record<string, unknown>;
          actions_json?: unknown[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["automation_flows"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
