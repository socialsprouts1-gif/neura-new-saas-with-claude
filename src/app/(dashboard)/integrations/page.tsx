import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { INTEGRATIONS, type IntegrationCategory } from "@/lib/integrations";
import { createWebhook, deleteWebhook } from "../portal-actions";
import IntegrationCard from "./IntegrationCard";
import WhatsAppCard from "./WhatsAppCard";
import ActionForm, { Field } from "@/components/ui/ActionForm";
import { PageHeader, Card, StatCard, Badge, EmptyState } from "@/components/ui/primitives";

const CATEGORY_ORDER: IntegrationCategory[] = [
  "Developer",
  "Automation",
  "E-commerce",
  "CRM",
  "Payments",
  "Productivity",
  "Support",
];

export default async function IntegrationsPage({
  searchParams,
}: {
  // The Embedded Signup callback reports its outcome by redirecting here.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId, role } = await requireOrg();
  const supabase = await createClient();
  const canManage = role === "owner" || role === "admin";

  const query = await searchParams;
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const signup = {
    connected: one("wa_connected"),
    error: one("wa_error"),
    note: one("wa_note"),
  };

  const [{ data: connections }, { data: webhooks }, waba] =
    await Promise.all([
      // credentials_encrypted is deliberately not selected — this page never
      // needs the secret, and not fetching it keeps it out of the RSC payload.
      supabase.from("org_integrations").select("provider, status, connected_at").eq("org_id", orgId),
      supabase.from("outgoing_webhooks").select("*").eq("org_id", orgId).order("created_at"),
      // access_token_encrypted is likewise never selected here.
      loadWabaConnections(supabase, orgId),
    ]);

  const wabaConnections = waba.data;
  const wabaError = waba.error;

  const connectedSet = new Set(
    (connections ?? []).filter((c) => c.status === "connected").map((c) => c.provider)
  );

  const host = (await headers()).get("host") ?? "your-domain";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const apiBase = `${proto}://${host}/api`;
  const webhookUrl = `${apiBase}/webhooks/whatsapp`;

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: INTEGRATIONS.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  const liveCount = INTEGRATIONS.filter(
    (i) => i.capability === "live" || i.capability === "via_webhook"
  ).length;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Integrations"
        subtitle="Connect Neura Chat to the tools you already run your business on."
      />

      <WhatsAppCard
        connections={wabaConnections ?? []}
        webhookUrl={webhookUrl}
        canManage={canManage}
        // A failed query returns no rows, which renders identically to having
        // no connection. Saying "Not connected" about a number that is
        // connected sends people back to Meta to fix nothing, so pass the
        // error through and let the card say what actually happened.
        loadError={wabaError?.message ?? null}
        // Connections loaded, but without health tracking. Say so quietly
        // rather than letting the banner's absence read as "all fine".
        healthUnavailable={waba.degraded}
        signup={signup}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Available" value={INTEGRATIONS.length} />
        <StatCard label="Connected" value={connectedSet.size} />
        <StatCard label="Work today" value={liveCount} hint="No provider app needed" />
        <StatCard label="Webhooks" value={webhooks?.length ?? 0} />
      </div>

      {byCategory.map((group) => (
        <section key={group.category} className="mb-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-3">
            {group.category}
          </h2>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {group.items.map((def) => (
              <IntegrationCard
                key={def.slug}
                def={def}
                connected={connectedSet.has(def.slug)}
                canManage={canManage}
              />
            ))}
          </div>
        </section>
      ))}

      {/* ---------------- Outgoing webhooks ---------------- */}
      <section className="mb-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-3">
          Outgoing webhooks
        </h2>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="order-2 lg:order-1 space-y-3">
            {webhooks && webhooks.length > 0 ? (
              webhooks.map((w) => (
                <Card key={w.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{w.name}</span>
                        <Badge tone={w.is_active ? "green" : "grey"}>
                          {w.is_active ? "active" : "paused"}
                        </Badge>
                      </div>
                      <code className="text-xs text-accent2-ink break-all block mb-2">
                        {w.target_url}
                      </code>
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <Badge key={e} tone="purple">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {canManage && (
                      <ActionForm action={deleteWebhook} submitLabel="Delete" compact>
                        <input type="hidden" name="id" value={w.id} />
                      </ActionForm>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/8">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
                      Signing secret
                    </div>
                    <code className="text-[11px] text-white/50 break-all">{w.secret}</code>
                    <p className="text-[11px] text-white/35 mt-2 leading-relaxed">
                      Every delivery is signed with this secret in the{" "}
                      <code className="text-white/60">X-Neura-Signature</code> header. Verify it
                      before trusting the payload.
                    </p>
                  </div>
                </Card>
              ))
            ) : (
              <EmptyState
                title="No webhooks yet"
                description="Add one to push message, status and contact events into Zapier, Make, n8n or any endpoint you control."
              />
            )}
          </div>

          <Card className="order-1 lg:order-2">
            <h3 className="font-semibold mb-1">New webhook</h3>
            <p className="text-sm text-white/50 mb-5">HTTPS endpoints only.</p>
            {canManage ? (
              <ActionForm action={createWebhook} submitLabel="Create webhook" resetOnSuccess>
                <div className="space-y-4">
                  <Field label="Name" name="name" required placeholder="Zapier — new leads" />
                  <Field
                    label="Target URL"
                    name="target_url"
                    type="url"
                    required
                    placeholder="https://hooks.zapier.com/…"
                  />
                  <fieldset>
                    <legend className="text-xs font-medium text-white/70 mb-2">Events</legend>
                    <div className="space-y-2">
                      {[
                        ["message.received", "Inbound message"],
                        ["message.status", "Delivery status change"],
                        ["contact.created", "New contact"],
                      ].map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2.5 text-sm text-white/70">
                          <input
                            type="checkbox"
                            name={value}
                            defaultChecked={value === "message.received"}
                            className="accent-[#00FF87] w-4 h-4"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm text-white/40">Only owners and admins can add webhooks.</p>
            )}
          </Card>
        </div>
      </section>

      <Card>
        <h2 className="font-semibold mb-1">Base URL</h2>
        <p className="text-sm text-white/50 mb-4">
          Point any tool that speaks HTTP at this base and authenticate with an API key from{" "}
          <span className="text-white/70">API Endpoints</span>.
        </p>
        <code className="block text-sm text-accent-ink bg-[var(--surface-1)] border border-white/10 rounded-xl p-3.5 break-all">
          {apiBase}
        </code>
      </Card>
    </div>
  );
}

/**
 * Connections, tolerating a database that has not run the latest migration.
 *
 * The health columns are a nicety; the connection itself is what the operator
 * needs to see and act on. Selecting both in one shot meant a pending
 * migration took the whole card down — including the controls for fixing it —
 * so fall back to the columns that have always existed and lose only the
 * health banner.
 */
async function loadWabaConnections(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string
) {
  const BASE = "id, waba_id, phone_number_id, meta_app_id, webhook_verify_token, status";

  const full = await supabase
    .from("waba_connections")
    .select(`${BASE}, last_error, last_error_at`)
    .eq("org_id", orgId)
    .order("created_at");

  if (!full.error) return { data: full.data, error: null, degraded: false };

  const base = await supabase
    .from("waba_connections")
    .select(BASE)
    .eq("org_id", orgId)
    .order("created_at");

  if (base.error) return { data: null, error: base.error, degraded: false };

  return {
    data: base.data.map((row) => ({ ...row, last_error: null, last_error_at: null })),
    // Not an error the operator has to act on before using the page, but
    // worth naming so the missing banner is explained rather than mysterious.
    error: null,
    degraded: true,
  };
}
