import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireFeature } from "@/lib/org";
import { Card } from "@/components/ui/primitives";
import { InstagramGlyph } from "@/components/landing/BrandGlyphs";
import { instagramEnv } from "@/lib/instagram-api";
import { redirectUri, SCOPES } from "@/lib/instagram";
import { formatDateTime } from "@/types/admin";
import { CheckCircle2, Mail, MousePointerClick, Send, UserPlus } from "lucide-react";
import Automations from "./Automations";
import type { AutomationRow } from "./AutomationEditor";

// Instagram, as a screen somebody can use.
//
// The hard-won lesson of the first version: the setup values — callback
// URL, verify token, scopes, redirect URI — are needed once, by one
// person, on one day. Leaving them at the top of the page made every
// visit after that one feel like reading a manual. They are at the
// bottom now, folded away, and the page opens on the thing the page is
// for.

export const dynamic = "force-dynamic";

const OUTCOMES: Record<string, { label: string; tone: string }> = {
  matching: { label: "working on it", tone: "text-white/40" },
  no_rule: { label: "no automation matched", tone: "text-white/40" },
  sent: { label: "answered", tone: "text-accent-ink" },
  sent_with_errors: { label: "partly sent", tone: "text-[#FACC15]" },
  failed: { label: "failed", tone: "text-[#F87171]" },
};

export default async function InstagramPage() {
  const { orgId } = await requireFeature("instagram");
  const supabase = await createClient();

  const env = instagramEnv();
  const configured = !("error" in env);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://neurachat.in";
  const verifyTokenSet = Boolean(process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN);

  const { data: connections, error } = await supabase
    .from("instagram_connections")
    .select("id, username, account_name, status, created_at, last_error")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const needsMigration = error?.code === "42P01";
  const accounts = connections ?? [];
  const live = accounts.find((account) => account.status === "active") ?? null;

  const [{ data: ruleRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("instagram_comment_rules")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("instagram_comment_events")
      .select("id, from_username, comment_text, outcome, error, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const rules: AutomationRow[] = ((ruleRows ?? []) as AutomationRow[]).map((row) => ({
    ...row,
    keywords: row.keywords ?? [],
    buttons: Array.isArray(row.buttons) ? row.buttons : [],
  }));
  const events = eventRows ?? [];

  // Summed here rather than in the database. The rows are already on
  // the page, and a second round trip to total a handful of numbers is
  // latency bought for nothing.
  const total = (field: keyof AutomationRow) =>
    rules.reduce((sum, rule) => sum + (Number(rule[field]) || 0), 0);

  const stats = [
    { label: "Messages sent", value: total("sent_count"), icon: Send, tint: "#E4405F" },
    { label: "Button taps", value: total("button_click_count"), icon: MousePointerClick, tint: "#405DE6" },
    { label: "New followers", value: total("follower_gain_count"), icon: UserPlus, tint: "#833AB4" },
    { label: "Emails", value: total("email_count"), icon: Mail, tint: "#F77737" },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      {/* --- who is connected -------------------------------------------- */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-7 mb-5 bg-gradient-to-br from-[#833AB4] via-[#E4405F] to-[#F77737]">
        <div className="absolute inset-0 bg-black/15" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FFFFFF]/20 backdrop-blur grid place-items-center flex-shrink-0">
            <InstagramGlyph className="w-7 h-7 text-[#FFFFFF]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-[#FFFFFF]">Instagram</h1>
            {live ? (
              <p className="text-[#FFFFFF]/85 text-sm mt-0.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Connected as @{live.username ?? live.account_name ?? "your account"}
              </p>
            ) : (
              <p className="text-[#FFFFFF]/85 text-sm mt-0.5">
                Answer comments and messages while you sleep.
              </p>
            )}
          </div>
          {!live && configured && (
            <Link
              href="/api/instagram/connect"
              className="px-5 py-2.5 rounded-xl bg-[#FFFFFF] text-[#C13584] font-semibold text-sm hover:bg-[#FFFFFF]/90 transition-colors"
            >
              Connect Instagram
            </Link>
          )}
        </div>
      </div>

      {needsMigration && (
        <Card className="mb-5 border-[#FACC15]/35">
          <p className="text-sm text-white/70 leading-relaxed">
            One more step: run{" "}
            <code className="text-white">supabase/updates/run-me-latest.sql</code> in the Supabase
            SQL editor, then reload.
          </p>
        </Card>
      )}

      {/* --- what it has done -------------------------------------------- */}
      {rules.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-4 border border-white/8 bg-white/4 min-w-0"
            >
              <div
                className="w-8 h-8 rounded-xl grid place-items-center mb-2.5"
                style={{ background: `${stat.tint}22`, color: stat.tint }}
              >
                <stat.icon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold tabular-nums leading-none">{stat.value}</div>
              <div className="text-[12px] text-white/40 mt-1.5">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* --- the automations ---------------------------------------------- */}
      <Card className="mb-5">
        <Automations rules={rules} accountId={live?.id ?? accounts[0]?.id ?? null} />
      </Card>

      {/* --- what actually happened --------------------------------------- */}
      {events.length > 0 && (
        <Card className="mb-5">
          <h2 className="text-lg font-semibold mb-4">Recent activity</h2>
          <div className="space-y-3">
            {events.map((event) => {
              const outcome = OUTCOMES[event.outcome] ?? {
                label: event.outcome,
                tone: "text-white/40",
              };
              return (
                <div key={event.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/6 grid place-items-center flex-shrink-0 text-[11px] font-semibold text-white/50">
                    {(event.from_username ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] truncate">
                      <span className="text-white/80">
                        {event.from_username ? `@${event.from_username}` : "Someone"}
                      </span>
                      {event.comment_text && (
                        <span className="text-white/40"> — {event.comment_text}</span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-white/30 mt-0.5">
                      {formatDateTime(event.created_at)}
                    </div>
                    {event.error && (
                      <div className="text-[11.5px] text-[#F87171] mt-1 leading-relaxed">
                        {event.error}
                      </div>
                    )}
                  </div>
                  <span className={`text-[12px] flex-shrink-0 ${outcome.tone}`}>
                    {outcome.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* --- the setup values, out of the way ------------------------------ */}
      <details className="group rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
        <summary className="px-5 py-4 cursor-pointer text-sm font-medium text-white/55 hover:text-white transition-colors list-none flex items-center justify-between">
          <span>Setup details for Meta</span>
          <span className="text-white/30 text-xs group-open:hidden">show</span>
          <span className="text-white/30 text-xs hidden group-open:inline">hide</span>
        </summary>

        <div className="px-5 pb-5 space-y-5 border-t border-white/6 pt-5">
          <p className="text-[13px] text-white/45 leading-relaxed">
            You only need these once, in your Meta app, under{" "}
            <span className="text-white/70">Instagram → API setup with Instagram business
            login</span>.
          </p>

          <Value label="Webhook callback URL" value={`${appUrl.replace(/\/+$/, "")}/api/webhooks/instagram`} />
          <Value label="OAuth redirect URI" value={redirectUri(appUrl)} />

          <div>
            <div className="text-[12px] font-medium text-white/55 mb-1.5">Verify token</div>
            <p className="text-[12.5px] text-white/40 leading-relaxed">
              {verifyTokenSet
                ? "Already set on this deployment. Paste the same value into Meta — they have to match exactly."
                : "Set INSTAGRAM_WEBHOOK_VERIFY_TOKEN in Vercel, redeploy, then paste the same value into Meta."}
            </p>
          </div>

          <div>
            <div className="text-[12px] font-medium text-white/55 mb-2">Subscribe to</div>
            <div className="flex flex-wrap gap-1.5">
              {["comments", "messages"].map((field) => (
                <code
                  key={field}
                  className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[11.5px] text-white/60"
                >
                  {field}
                </code>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[12px] font-medium text-white/55 mb-2">Permissions to request</div>
            <div className="flex flex-wrap gap-1.5">
              {SCOPES.map((scope) => (
                <code
                  key={scope}
                  className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[11.5px] text-white/60"
                >
                  {scope}
                </code>
              ))}
            </div>
          </div>

          <p className="text-[12px] text-white/30 leading-relaxed">
            Meta only delivers webhooks when the app mode is Live. In Development mode the
            handshake succeeds and nothing ever arrives, which looks exactly like a broken endpoint.
          </p>

          {!configured && (
            <p className="text-[12.5px] text-[#FACC15] leading-relaxed">
              {"error" in env ? env.error : ""}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[12px] font-medium text-white/55 mb-1.5">{label}</div>
      <code className="block px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-white/8 text-[12px] text-accent-ink break-all">
        {value}
      </code>
    </div>
  );
}
