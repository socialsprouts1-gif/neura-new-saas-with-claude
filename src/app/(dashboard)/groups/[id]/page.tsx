import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { listConnections } from "@/lib/connections";
import { optionLabel } from "@/lib/number-identity";
import {
  updateContactGroup,
  addContactsToGroup,
  removeContactFromGroup,
  broadcastToGroup,
} from "../../manage-actions";
import ActionForm, { Field, SelectField, TextareaField } from "@/components/ui/ActionForm";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui/primitives";
import { planBroadcast, describePlan, explainSkip } from "@/lib/group-broadcast";

/**
 * One group: who is in it, and sending to them.
 *
 * Worth saying once here rather than in three tooltips: this is not a
 * WhatsApp group. Meta's Cloud API has no group endpoints — groups exist
 * only in the consumer and Business apps — so what this does is send each
 * member their own message. That is also what a business wants, because a
 * reply comes back as a private conversation rather than to an audience.
 */
export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { orgId } = await requireOrg();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: group }, { data: memberRows }, { data: contacts }, connections, { data: history }] =
    await Promise.all([
      supabase
        .from("contact_groups")
        .select("*")
        .eq("id", id)
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("contact_group_members")
        .select("contact_id, contacts(id, name, wa_id, opted_out)")
        .eq("group_id", id)
        .eq("org_id", orgId)
        .limit(500),
      supabase
        .from("contacts")
        .select("id, name, wa_id")
        .eq("org_id", orgId)
        .order("name")
        .limit(500),
      listConnections(supabase, orgId),
      supabase
        .from("group_broadcasts")
        .select("id, body, sent_count, skipped_count, failed_count, created_at")
        .eq("group_id", id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  if (!group) notFound();

  const rows = memberRows ?? [];
  const memberIds = new Set(rows.map((row) => row.contact_id));
  const active = connections.filter((connection) => connection.status === "active");

  // The window is per conversation, so who can be reached right now is a
  // live question — answered here rather than after a send half-fails.
  const { data: conversations } = memberIds.size
    ? await supabase
        .from("conversations")
        .select("id, contact_id, last_inbound_at")
        .eq("org_id", orgId)
        .in("contact_id", [...memberIds])
    : { data: [] };

  const threadByContact = new Map(
    (conversations ?? []).map((row) => [row.contact_id, row])
  );

  const members = rows.map((row) => {
    const contact = row.contacts as
      | { id: string; name: string | null; wa_id: string; opted_out: boolean | null }
      | null;
    const thread = threadByContact.get(row.contact_id);
    return {
      contactId: row.contact_id,
      name: contact?.name ?? null,
      waId: contact?.wa_id ?? "",
      optedOut: Boolean(contact?.opted_out),
      conversationId: thread?.id ?? null,
      lastInboundAt: thread?.last_inbound_at ?? null,
    };
  });

  const plan = planBroadcast(members);
  const skipReason = new Map(plan.skipped.map((entry) => [entry.member.contactId, entry.why]));
  const notYetIn = (contacts ?? []).filter((contact) => !memberIds.has(contact.id));

  return (
    <div className="p-6 md:p-8">
      <Link
        href="/groups"
        className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white mb-4 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All groups
      </Link>

      <PageHeader
        title={group.name}
        subtitle={group.description ?? "A named segment of contacts."}
      />

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6 order-2 lg:order-1">
          <Card>
            <div className="flex flex-wrap items-center gap-2.5 mb-1">
              <h2 className="font-semibold">Members</h2>
              <Badge tone="grey">{members.length}</Badge>
            </div>
            <p className="text-sm text-white/45 mb-4 leading-relaxed">{describePlan(plan)}</p>

            {members.length === 0 ? (
              <EmptyState
                title="Nobody in this group yet"
                description="Add contacts on the right, or fill it from a tag on the groups page."
              />
            ) : (
              <ul className="divide-y divide-white/6">
                {members.map((member) => {
                  const why = skipReason.get(member.contactId);
                  return (
                    <li
                      key={member.contactId}
                      className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{member.name || member.waId}</div>
                        <div className="text-[11px] text-white/35 tabular-nums">
                          {member.waId}
                          {why && <span className="text-white/30"> · {explainSkip(why)}</span>}
                        </div>
                      </div>
                      {!why && <Badge tone="green">reachable now</Badge>}
                      <ActionForm action={removeContactFromGroup} submitLabel="Remove" compact>
                        <input type="hidden" name="group_id" value={group.id} />
                        <input type="hidden" name="contact_id" value={member.contactId} />
                      </ActionForm>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {(history ?? []).length > 0 && (
            <Card>
              <h2 className="font-semibold mb-3">Recently sent</h2>
              <ul className="space-y-3">
                {(history ?? []).map((entry) => (
                  <li key={entry.id} className="text-xs">
                    <div className="text-white/65 leading-relaxed line-clamp-2">{entry.body}</div>
                    <div className="text-[11px] text-white/35 mt-1">
                      {new Date(entry.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {entry.sent_count} sent
                      {entry.skipped_count > 0 && `, ${entry.skipped_count} skipped`}
                      {entry.failed_count > 0 && `, ${entry.failed_count} failed`}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6 order-1 lg:order-2">
          <Card>
            <h2 className="font-semibold mb-1">Send to this group</h2>
            <p className="text-xs text-white/45 mb-4 leading-relaxed">
              Each member gets their own message — WhatsApp has no group to post into, and a
              private reply is what you want anyway. Anyone who last wrote over 24 hours ago needs
              an approved template, which is what a campaign is for.
            </p>

            <ActionForm action={broadcastToGroup} submitLabel="Send now" resetOnSuccess>
              <input type="hidden" name="group_id" value={group.id} />
              {active.length > 1 && (
                <SelectField
                  label="Send from"
                  name="connection_id"
                  defaultValue={group.connection_id ?? ""}
                  options={active.map((connection) => ({
                    value: connection.id,
                    label: optionLabel(connection),
                  }))}
                />
              )}
              <TextareaField
                label="Message"
                name="body"
                required
                rows={5}
                placeholder="New stock landed this morning — reply STOCK and I'll send photos."
              />
            </ActionForm>
          </Card>

          <Card>
            <h2 className="font-semibold mb-3">Add contacts</h2>
            {notYetIn.length === 0 ? (
              <p className="text-xs text-white/40 leading-relaxed">
                Every contact in this workspace is already in this group.
              </p>
            ) : (
              <ActionForm action={addContactsToGroup} submitLabel="Add to group">
                <input type="hidden" name="group_id" value={group.id} />
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                  {notYetIn.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="contact_ids"
                        value={contact.id}
                        className="accent-[var(--accent)] w-4 h-4"
                      />
                      <span className="text-xs min-w-0 flex-1 truncate">
                        {contact.name || contact.wa_id}
                        <span className="block text-[10px] text-white/30 tabular-nums">
                          {contact.wa_id}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </ActionForm>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold mb-3">Group settings</h2>
            <ActionForm action={updateContactGroup} submitLabel="Save">
              <input type="hidden" name="id" value={group.id} />
              <Field label="Name" name="name" required defaultValue={group.name} />
              <Field
                label="Description"
                name="description"
                defaultValue={group.description ?? ""}
              />
              {active.length > 0 && (
                <SelectField
                  label="Default number"
                  name="connection_id"
                  defaultValue={group.connection_id ?? ""}
                  options={[
                    { value: "", label: "No default" },
                    ...active.map((connection) => ({
                      value: connection.id,
                      label: optionLabel(connection),
                    })),
                  ]}
                />
              )}
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
