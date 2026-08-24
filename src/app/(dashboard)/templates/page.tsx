import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { PageHeader, Card, StatCard, Badge, Table, Td, EmptyState, statusTone } from "@/components/ui/primitives";
import { formatDate } from "@/types/admin";

export default async function TemplatesPage() {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const { data: templates, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const all = templates ?? [];

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="WhatsApp templates"
        subtitle="Approved messages you can send outside the 24-hour window."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Templates" value={all.length} />
        <StatCard label="Approved" value={all.filter((t) => t.status === "approved").length} />
        <StatCard label="Pending" value={all.filter((t) => t.status === "pending").length} />
        <StatCard label="Rejected" value={all.filter((t) => t.status === "rejected").length} />
      </div>

      {/* Templates are created and approved in Meta, not here. Saying so is
          more useful than a form that would desync from the real thing. */}
      <Card className="mb-6">
        <h2 className="font-semibold mb-1">Templates are created in Meta</h2>
        <p className="text-sm text-white/50 leading-relaxed mb-4">
          Meta reviews and approves every template, so they are authored in the WhatsApp Manager
          rather than here. This screen mirrors what your account holds so campaigns and the
          chatbot&apos;s Send Template node can reference them by name.
        </p>
        <a
          href="https://business.facebook.com/wa/manage/message-templates/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-sm"
        >
          Open WhatsApp Manager
        </a>
        <p className="text-xs text-white/35 mt-4">
          Automatic sync from Meta is not built yet — this list reflects rows stored here, so a
          template approved in Meta will not appear on its own.
        </p>
      </Card>

      {error ? (
        <EmptyState
          title="Couldn't load templates"
          description={`${error.message}. If this mentions a missing relation, run supabase/setup.sql again.`}
        />
      ) : all.length > 0 ? (
        <Table head={["Name", "Category", "Language", "Status", "Created"]}>
          {all.map((template) => (
            <tr key={template.id} className="hover:bg-white/3 transition-colors">
              <Td>
                <code className="text-[#00D4FF] text-xs">{template.name}</code>
              </Td>
              <Td>
                <Badge tone="purple">{template.category}</Badge>
              </Td>
              <Td className="text-white/60 text-xs">{template.language}</Td>
              <Td>
                <Badge tone={statusTone(template.status)}>{template.status}</Badge>
              </Td>
              <Td className="text-white/40 text-xs whitespace-nowrap">
                {formatDate(template.created_at)}
              </Td>
            </tr>
          ))}
        </Table>
      ) : (
        <EmptyState
          title="No templates stored yet"
          description="Create one in WhatsApp Manager, then reference it by name in a campaign or a Send Template node."
        />
      )}
    </div>
  );
}
