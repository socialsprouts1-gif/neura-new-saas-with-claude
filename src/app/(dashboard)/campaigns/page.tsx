import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { createCampaign } from "../actions";
import ActionForm, { Field, SelectField } from "@/components/ui/ActionForm";
import { PageHeader, Card, Badge, Table, Td, EmptyState, statusTone } from "@/components/ui/primitives";
import { formatDate } from "@/types/admin";

export default async function CampaignsPage() {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const [{ data: campaigns, error }, { data: templates }, { count: contactCount }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, status, scheduled_at, created_at, segment_filter, message_templates(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("message_templates")
      .select("id, name, status")
      .eq("org_id", orgId)
      .eq("status", "approved"),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("org_id", orgId),
  ]);

  const templateOptions = [
    { value: "", label: templates?.length ? "No template" : "No approved templates yet" },
    ...(templates ?? []).map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Campaigns"
        subtitle="Send an approved template to a segment of your contacts."
      />

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="order-2 lg:order-1">
          {error ? (
            <EmptyState
              title="Couldn't load campaigns"
              description={`${error.message}. If this mentions a missing relation, the database migrations haven't been applied yet.`}
            />
          ) : campaigns && campaigns.length > 0 ? (
            <Table head={["Template", "Segment", "Status", "Scheduled", "Created"]}>
              {campaigns.map((c) => {
                const tpl = c.message_templates as { name: string } | null;
                const filter = c.segment_filter as { tags?: string[] };
                return (
                  <tr key={c.id} className="hover:bg-white/3 transition-colors">
                    <Td className="font-medium">{tpl?.name ?? <span className="text-white/30">—</span>}</Td>
                    <Td>
                      {filter?.tags?.length ? (
                        <Badge tone="blue">{filter.tags[0]}</Badge>
                      ) : (
                        <span className="text-white/40 text-xs">All contacts</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={statusTone(c.status)}>{c.status}</Badge>
                    </Td>
                    <Td className="text-white/50 text-xs whitespace-nowrap">
                      {formatDate(c.scheduled_at)}
                    </Td>
                    <Td className="text-white/40 text-xs whitespace-nowrap">{formatDate(c.created_at)}</Td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <EmptyState
              title="No campaigns yet"
              description="Create a campaign to send an approved WhatsApp template to a group of contacts."
            />
          )}

          <p className="text-xs text-white/35 mt-4">
            Campaigns are created and scheduled here. The worker that actually dispatches
            them to Meta is not built yet, so a scheduled campaign will stay in its
            scheduled state.
          </p>
        </div>

        <Card className="order-1 lg:order-2">
          <h2 className="font-semibold mb-1">New campaign</h2>
          <p className="text-sm text-white/50 mb-5">
            {contactCount ?? 0} contact{contactCount === 1 ? "" : "s"} available to target.
          </p>
          <ActionForm action={createCampaign} submitLabel="Create campaign" resetOnSuccess>
            <div className="space-y-4">
              <Field label="Campaign name" name="name" required placeholder="Diwali offer" />
              <SelectField label="Template" name="template_id" options={templateOptions} />
              <Field
                label="Target tag"
                name="tag"
                placeholder="lead"
                hint="Leave blank to target every contact"
              />
              <Field
                label="Schedule for"
                name="scheduled_at"
                type="datetime-local"
                hint="Leave blank to save as a draft"
              />
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
