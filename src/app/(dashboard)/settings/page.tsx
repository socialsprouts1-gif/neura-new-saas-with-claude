import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { connectWaba, disconnectWaba, renameOrganization, createSupportTicket } from "../actions";
import ActionForm, { Field, SelectField, TextareaField } from "@/components/ui/ActionForm";
import { PageHeader, Card, Badge, statusTone } from "@/components/ui/primitives";
import { formatMoney, formatDate } from "@/types/admin";

export default async function SettingsPage() {
  const { orgId, orgName, role } = await requireOrg();
  const supabase = await createClient();

  const [{ data: connections }, { data: members }, { data: subscription }, { data: tickets }] =
    await Promise.all([
      supabase.from("waba_connections").select("*").eq("org_id", orgId).order("created_at"),
      supabase.from("org_members").select("user_id, role, created_at").eq("org_id", orgId),
      supabase.from("subscriptions").select("*, plans(name, price_cents, currency)").eq("org_id", orgId).maybeSingle(),
      supabase
        .from("support_tickets")
        .select("id, subject, status, priority, created_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  // Built from the request host so the value shown is the URL Meta must
  // actually call, not a hardcoded guess.
  const host = (await headers()).get("host") ?? "your-domain";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const webhookUrl = `${proto}://${host}/api/webhooks/whatsapp`;

  const canManage = role === "owner" || role === "admin";
  const plan = subscription?.plans as { name: string; price_cents: number; currency: string } | null | undefined;

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <PageHeader title="Settings" subtitle="Organization, WhatsApp connection, team and billing." />

      <div className="space-y-6">
        {/* ---------------- WhatsApp connection ---------------- */}
        <Card>
          <h2 className="font-semibold mb-1">WhatsApp connection</h2>
          <p className="text-sm text-white/50 mb-5">
            Connect a number from your own Meta WhatsApp Business Account. The access
            token is encrypted before it is stored.
          </p>

          {connections && connections.length > 0 ? (
            <div className="space-y-3">
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 bg-white/3 border border-white/8 rounded-xl p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm">{c.phone_number_id}</span>
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                    </div>
                    <div className="text-xs text-white/40">WABA {c.waba_id} · App {c.meta_app_id}</div>
                  </div>
                  {canManage && (
                    <ActionForm action={disconnectWaba} submitLabel="Disconnect" compact>
                      <input type="hidden" name="id" value={c.id} />
                    </ActionForm>
                  )}
                </div>
              ))}

              {/* Registering the webhook is a separate step in the Meta
                  dashboard — storing credentials here does not tell Meta
                  where to deliver messages. Both values it asks for are
                  shown so nobody has to query the database for them. */}
              <div className="bg-[#0A0A0F] border border-[#00FF87]/20 rounded-xl p-5 mt-4">
                <div className="text-sm font-semibold text-[#00FF87] mb-1">
                  Final step: register this webhook with Meta
                </div>
                <p className="text-xs text-white/50 mb-4">
                  Inbound messages will not reach your inbox until you paste both values into
                  Meta → your app → WhatsApp → Configuration, and subscribe to the{" "}
                  <code className="text-white/70">messages</code> field.
                </p>

                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
                      Callback URL
                    </div>
                    <code className="block text-xs text-[#00D4FF] break-all bg-white/3 border border-white/8 rounded-lg p-2.5">
                      {webhookUrl}
                    </code>
                  </div>

                  {connections.map((c) => (
                    <div key={`vt-${c.id}`}>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
                        Verify token
                        <span className="text-white/25 normal-case tracking-normal font-normal">
                          {" "}· for {c.phone_number_id}
                        </span>
                      </div>
                      <code className="block text-xs text-[#00FF87] break-all bg-white/3 border border-white/8 rounded-lg p-2.5">
                        {c.webhook_verify_token}
                      </code>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-white/35 mt-4 leading-relaxed">
                  After saving in Meta, send a message to your number from any phone. Check
                  Admin → Webhook logs to confirm the delivery arrived and its signature
                  verified.
                </p>
              </div>
            </div>
          ) : canManage ? (
            <ActionForm action={connectWaba} submitLabel="Connect number" resetOnSuccess>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="WABA ID" name="waba_id" required placeholder="123456789012345" />
                <Field
                  label="Phone number ID"
                  name="phone_number_id"
                  required
                  placeholder="098765432109876"
                  hint="Meta → WhatsApp → API Setup"
                />
                <Field label="Meta App ID" name="meta_app_id" required placeholder="1234567890" />
                <Field
                  label="Access token"
                  name="access_token"
                  type="password"
                  required
                  placeholder="EAAG…"
                  hint="Encrypted with AES-256-GCM before storage"
                />
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-white/40">
              No number connected. Ask an owner or admin to connect one.
            </p>
          )}
        </Card>

        {/* ---------------- Organization ---------------- */}
        <Card>
          <h2 className="font-semibold mb-1">Organization</h2>
          <p className="text-sm text-white/50 mb-5">The name shown across the workspace.</p>
          {canManage ? (
            <ActionForm action={renameOrganization} submitLabel="Save name">
              <Field label="Organization name" name="name" required defaultValue={orgName} />
            </ActionForm>
          ) : (
            <p className="text-sm">{orgName}</p>
          )}
        </Card>

        {/* ---------------- Plan ---------------- */}
        <Card>
          <h2 className="font-semibold mb-1">Plan</h2>
          <p className="text-sm text-white/50 mb-5">Your current subscription.</p>
          {subscription ? (
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-lg font-semibold">{plan?.name ?? "Custom"}</div>
                <div className="text-sm text-white/50">
                  {plan ? formatMoney(plan.price_cents, plan.currency) : "—"} · renews{" "}
                  {formatDate(subscription.current_period_end)}
                </div>
              </div>
              <Badge tone={statusTone(subscription.status)}>{subscription.status}</Badge>
            </div>
          ) : (
            <p className="text-sm text-white/40">
              No subscription on this organization yet. Platform staff assign plans from the
              admin panel.
            </p>
          )}
        </Card>

        {/* ---------------- Team ---------------- */}
        <Card>
          <h2 className="font-semibold mb-1">Team</h2>
          <p className="text-sm text-white/50 mb-5">
            {members?.length ?? 0} member{members?.length === 1 ? "" : "s"} in this organization.
          </p>
          <div className="space-y-2">
            {(members ?? []).map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between bg-white/3 border border-white/8 rounded-xl px-4 py-3"
              >
                <span className="font-mono text-xs text-white/60 truncate">{m.user_id}</span>
                <Badge tone={m.role === "owner" ? "green" : "grey"}>{m.role}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* ---------------- Support ---------------- */}
        <Card>
          <h2 className="font-semibold mb-1">Support</h2>
          <p className="text-sm text-white/50 mb-5">Raise a ticket with the Neura Chat team.</p>

          <ActionForm action={createSupportTicket} submitLabel="Raise ticket" resetOnSuccess>
            <div className="space-y-4">
              <Field label="Subject" name="subject" required placeholder="Messages not sending" />
              <SelectField
                label="Priority"
                name="priority"
                defaultValue="normal"
                options={[
                  { value: "low", label: "Low" },
                  { value: "normal", label: "Normal" },
                  { value: "high", label: "High" },
                  { value: "urgent", label: "Urgent" },
                ]}
              />
              <TextareaField label="Message" name="body" required rows={4} placeholder="What's happening?" />
            </div>
          </ActionForm>

          {tickets && tickets.length > 0 && (
            <div className="mt-6 pt-5 border-t border-white/8 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">
                Recent tickets
              </div>
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{t.subject}</span>
                  <Badge tone={statusTone(t.status)}>{t.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
