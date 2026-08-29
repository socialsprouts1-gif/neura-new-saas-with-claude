import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { listConnections } from "@/lib/connections";
import {
  PageHeader,
  Card,
  StatCard,
  Badge,
  EmptyState,
  type Tone,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/types/admin";
import {
  RefreshAllButton,
  MakeDefaultButton,
  CheckNumberButton,
  NumberLabel,
} from "./NumberControls";

export default async function NumbersPage() {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const connections = await listConnections(supabase, orgId);

  // How busy each number is, so the list says something beyond "connected".
  const { data: conversations } = await supabase
    .from("conversations")
    .select("connection_id")
    .eq("org_id", orgId)
    .limit(5000);

  const threadsByConnection = new Map<string, number>();
  for (const row of conversations ?? []) {
    if (!row.connection_id) continue;
    threadsByConnection.set(row.connection_id, (threadsByConnection.get(row.connection_id) ?? 0) + 1);
  }

  const active = connections.filter((connection) => connection.status === "active");

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="WhatsApp numbers"
        subtitle="Every number in this workspace, and which one is used by default."
        action={<RefreshAllButton />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Numbers" value={connections.length} />
        <StatCard label="Active" value={active.length} />
        <StatCard
          label="Needs attention"
          value={connections.filter((connection) => connection.lastError).length}
        />
        <StatCard label="Conversations" value={conversations?.length ?? 0} />
      </div>

      {connections.length === 0 ? (
        <EmptyState
          title="No numbers connected"
          description="Connect a WhatsApp number and it will appear here, ready to use across the inbox, chatbots and campaigns."
          action={
            <Link href="/integrations" className="btn-primary text-sm">
              Connect a number
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => (
            <Card key={connection.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1">
                    <span className="text-lg font-semibold tabular-nums">
                      {connection.displayPhoneNumber ?? (
                        <span className="text-white/40 text-base">
                          Number not read from Meta yet
                        </span>
                      )}
                    </span>
                    <Badge tone={statusTone(connection.status)}>{connection.status}</Badge>
                    {connection.qualityRating && (
                      <Badge tone={qualityTone(connection.qualityRating)}>
                        quality {connection.qualityRating.toLowerCase()}
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm text-white/55 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <NumberLabel id={connection.id} label={connection.label} />
                    {connection.verifiedName && (
                      <span className="text-white/40">
                        shown to customers as &ldquo;{connection.verifiedName}&rdquo;
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-white/30 mt-2 font-mono">
                    WABA {connection.wabaId} · Number ID {connection.phoneNumberId}
                  </div>

                  <div className="text-[11px] text-white/35 mt-1">
                    {threadsByConnection.get(connection.id) ?? 0} conversation
                    {(threadsByConnection.get(connection.id) ?? 0) === 1 ? "" : "s"}
                    {connection.lastErrorAt && (
                      <> · last problem {formatDateTime(connection.lastErrorAt)}</>
                    )}
                  </div>

                  {connection.lastError && (
                    <p className="text-xs text-[#F87171] mt-2 max-w-xl">{connection.lastError}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <MakeDefaultButton id={connection.id} isDefault={connection.isDefault} />
                  <CheckNumberButton id={connection.id} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <h2 className="font-semibold mb-1">How the default is used</h2>
        <p className="text-sm text-white/50 leading-relaxed">
          A reply in the inbox always goes out on the number the customer messaged, whatever the
          default is — so nobody ever sees an answer arrive from a number they have never written
          to. The default covers everything else: a campaign or a chatbot that doesn&apos;t name a
          number of its own, and a new template or form, which is created on the default
          number&apos;s WhatsApp Business Account.
        </p>
        <Link href="/integrations" className="btn-secondary text-sm mt-4">
          Connect another number
        </Link>
      </Card>
    </div>
  );
}

function statusTone(status: string): Tone {
  if (status === "active") return "green";
  if (status === "pending") return "amber";
  return "red";
}

function qualityTone(rating: string): Tone {
  const value = rating.toUpperCase();
  if (value === "GREEN" || value === "HIGH") return "green";
  if (value === "YELLOW" || value === "MEDIUM") return "amber";
  if (value === "RED" || value === "LOW") return "red";
  return "grey";
}
