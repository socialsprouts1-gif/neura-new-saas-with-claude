import { AlertTriangle, KeyRound } from "lucide-react";
import { connectWaba, disconnectWaba, regenerateVerifyToken, verifyWabaConnection } from "../actions";
import ActionForm, { Field } from "@/components/ui/ActionForm";
import { Badge, statusTone } from "@/components/ui/primitives";

// WhatsApp is not one integration among many — it is the product. So it gets
// a full-width card above the catalogue rather than a tile inside it, and it
// carries the whole connection lifecycle: credentials in, webhook values out.

type Connection = {
  id: string;
  waba_id: string;
  phone_number_id: string;
  meta_app_id: string;
  webhook_verify_token: string;
  status: string;
  last_error: string | null;
  last_error_at: string | null;
};

export default function WhatsAppCard({
  connections,
  webhookUrl,
  canManage,
  loadError,
  healthUnavailable,
}: {
  connections: Connection[];
  webhookUrl: string;
  canManage: boolean;
  /** Set when the connection query itself failed — usually a pending migration. */
  loadError?: string | null;
  /** Connections loaded, but the health columns are not there yet. */
  healthUnavailable?: boolean;
}) {
  const connected = connections.length > 0;

  return (
    <div className="relative rounded-2xl border border-[#25D366]/25 bg-gradient-to-br from-[#25D366]/8 via-[#0A0A0F] to-[#00D4FF]/5 p-6 md:p-7 mb-8 overflow-hidden">
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#25D366]/10 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex flex-wrap items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-[#25D366]/12 border border-[#25D366]/25 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-[#25D366]" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413Z" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h2 className="text-lg font-semibold">WhatsApp Business</h2>
              <Badge tone={loadError ? "red" : connected ? "green" : "grey"}>
                {loadError ? "Unknown" : connected ? "Connected" : "Not connected"}
              </Badge>
              <Badge tone="blue">Core</Badge>
            </div>
            <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
              Connect a number from your own Meta WhatsApp Business Account. Every message is
              sent under your credentials — no reseller in the middle. The access token is
              encrypted with AES-256-GCM before it is stored.
            </p>
          </div>
        </div>

        {loadError ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-[#FF5C5C]/30 bg-[#FF5C5C]/8 p-4">
            <AlertTriangle className="w-4 h-4 text-[#FF5C5C] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-[#FF8A8A] mb-1">
                Couldn&apos;t read the WhatsApp connection
              </div>
              <p className="text-xs text-white/60 leading-relaxed mb-2">
                Your number may well be connected — this is the lookup failing, not the
                connection. If the message below mentions a missing column, run{" "}
                <span className="font-mono text-white/75">supabase/setup.sql</span> again;
                connection health tracking added two columns.
              </p>
              <p className="text-xs text-white/40 font-mono break-words">{loadError}</p>
            </div>
          </div>
        ) : connected ? (
          <div className="space-y-3">
            {connections.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-white/4 border border-white/10 rounded-xl p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-sm">{c.phone_number_id}</span>
                    <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                  </div>
                  <div className="text-xs text-white/40">
                    WABA {c.waba_id} · App {c.meta_app_id}
                  </div>
                </div>

                {/* Asks Meta the same permission question a send asks, without
                    sending. Every credential fault so far could only be found
                    by messaging a real person and reading server logs. */}
                {canManage && (
                  <ActionForm action={verifyWabaConnection} submitLabel="Test connection" compact>
                    <input type="hidden" name="id" value={c.id} />
                  </ActionForm>
                )}

                {/* Rotating an access token is routine — Meta's API Setup
                    token dies every 24 hours — and it must not go through
                    Disconnect, which deletes the row and with it the verify
                    token Meta was registered against. connectWaba upserts on
                    phone_number_id and keeps that token, so the fix stays a
                    single paste. */}
                {canManage && (
                  <details className="w-full group">
                    <summary className="cursor-pointer text-xs text-[#00D4FF] hover:text-[#00FF87] transition-colors list-none flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      Update access token
                      <span className="text-white/30">— keeps your verify token</span>
                    </summary>
                    <div className="mt-3 pt-3 border-t border-white/8">
                      <ActionForm action={connectWaba} submitLabel="Save token">
                        <input type="hidden" name="waba_id" value={c.waba_id} />
                        <input type="hidden" name="phone_number_id" value={c.phone_number_id} />
                        <input type="hidden" name="meta_app_id" value={c.meta_app_id} />
                        <Field
                          name="access_token"
                          label="New access token"
                          type="password"
                          required
                          placeholder="EAAO…"
                          hint="A System User token never expires. The one on Meta's API Setup page lasts 24 hours."
                        />
                      </ActionForm>
                    </div>
                  </details>
                )}

                {/* A credential rejection breaks every send, not one message,
                    so it belongs here rather than only in whichever chat
                    thread happened to hit it first. */}
                {c.last_error && (
                  <div className="w-full flex items-start gap-2.5 rounded-lg border border-[#FF5C5C]/30 bg-[#FF5C5C]/8 p-3">
                    <AlertTriangle className="w-4 h-4 text-[#FF5C5C] flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[#FF8A8A] mb-0.5">
                        Meta refused the last send
                        {c.last_error_at && (
                          <span className="text-white/35 font-normal">
                            {" · "}
                            {new Date(c.last_error_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">{c.last_error}</p>
                    </div>
                  </div>
                )}

                {canManage && (
                  <details className="w-full">
                    <summary className="cursor-pointer text-xs text-white/35 hover:text-white/60 transition-colors list-none">
                      Disconnect this number
                    </summary>
                    <div className="mt-3 pt-3 border-t border-white/8 flex flex-wrap items-center gap-3">
                      <p className="text-xs text-white/45 leading-relaxed flex-1 min-w-[16rem]">
                        This deletes the connection, including its verify token. Reconnecting
                        generates a new one, so you would have to re-register the webhook with
                        Meta. To change the access token, use{" "}
                        <span className="text-white/70">Update access token</span> above instead.
                      </p>
                      <ActionForm action={disconnectWaba} submitLabel="Disconnect" compact>
                        <input type="hidden" name="id" value={c.id} />
                      </ActionForm>
                    </div>
                  </details>
                )}
              </div>
            ))}

            {healthUnavailable && (
              <p className="text-[11px] text-white/35 leading-relaxed">
                Connection health tracking is off — run{" "}
                <span className="font-mono text-white/55">supabase/setup.sql</span> to add the
                two columns it needs. Everything else on this page works without it.
              </p>
            )}

            {/* Storing credentials does not tell Meta where to deliver
                messages — that is a separate step in their dashboard, and
                the two values it asks for are shown here so nobody has to
                query the database for them. */}
            <div className="bg-[#0A0A0F] border border-[#00FF87]/20 rounded-xl p-5 mt-4">
              <div className="text-sm font-semibold text-[#00FF87] mb-1">
                Register this webhook with Meta
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
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                        Verify token
                        <span className="text-white/25 normal-case tracking-normal font-normal">
                          {" "}
                          · for {c.phone_number_id}
                        </span>
                      </div>
                      {canManage && (
                        <ActionForm
                          action={regenerateVerifyToken}
                          submitLabel="Regenerate"
                          compact
                        >
                          <input type="hidden" name="id" value={c.id} />
                        </ActionForm>
                      )}
                    </div>
                    <code className="block text-xs text-[#00FF87] break-all bg-white/3 border border-white/8 rounded-lg p-2.5">
                      {c.webhook_verify_token}
                    </code>
                    <p className="text-[10px] text-white/30 mt-1.5">
                      {c.webhook_verify_token.length} characters. Meta rejects the handshake
                      unless this matches exactly — it is not your access token.
                    </p>
                  </div>
                ))}
              </div>
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
                hint="Use a permanent System User token, not the 24-hour one"
              />
            </div>
          </ActionForm>
        ) : (
          <p className="text-sm text-white/40">
            No number connected. Ask an owner or admin to connect one.
          </p>
        )}
      </div>
    </div>
  );
}
