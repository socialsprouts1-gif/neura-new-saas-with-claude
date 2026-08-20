import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { saveMediaAsset, deleteMediaAsset } from "../portal-actions";
import ActionForm, { Field, SelectField } from "@/components/ui/ActionForm";
import { PageHeader, Card, StatCard, Badge, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/types/admin";

const TYPE_TONE = { image: "blue", video: "purple", document: "amber", audio: "green" } as const;

export default async function GalleryPage() {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const { data: assets, error } = await supabase
    .from("media_assets")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const all = assets ?? [];
  const counts = {
    image: all.filter((a) => a.media_type === "image").length,
    video: all.filter((a) => a.media_type === "video").length,
    document: all.filter((a) => a.media_type === "document").length,
  };

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Gallery"
        subtitle="Reusable media for campaigns and replies — add once, send many times."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Assets" value={all.length} />
        <StatCard label="Images" value={counts.image} />
        <StatCard label="Videos" value={counts.video} />
        <StatCard label="Documents" value={counts.document} />
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="order-2 lg:order-1">
          {error ? (
            <EmptyState
              title="Couldn't load media"
              description={`${error.message}. If this mentions a missing relation, the portal migration hasn't been applied yet.`}
            />
          ) : all.length > 0 ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {all.map((a) => (
                <div key={a.id} className="glass-card overflow-hidden">
                  <div className="aspect-video bg-[#0A0A0F] flex items-center justify-center overflow-hidden">
                    {a.media_type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/25 text-xs uppercase tracking-widest">
                        {a.media_type}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-medium text-sm truncate">{a.name}</h3>
                      <Badge tone={TYPE_TONE[a.media_type]}>{a.media_type}</Badge>
                    </div>
                    <p className="text-[10px] text-white/35 mb-3">{formatDate(a.created_at)}</p>
                    <div className="flex items-center gap-2">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        Open
                      </a>
                      <ActionForm action={deleteMediaAsset} submitLabel="Delete" compact>
                        <input type="hidden" name="id" value={a.id} />
                      </ActionForm>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No media yet"
              description="Add an image or document by URL so you can reuse it across campaigns."
            />
          )}
        </div>

        <Card className="order-1 lg:order-2">
          <h2 className="font-semibold mb-1">Add media</h2>
          <p className="text-sm text-white/50 mb-5">
            Paste a public HTTPS URL. Direct file upload needs storage, which isn&apos;t wired up yet.
          </p>
          <ActionForm action={saveMediaAsset} submitLabel="Add media" resetOnSuccess>
            <div className="space-y-4">
              <Field label="Name" name="name" required placeholder="Diwali banner" />
              <Field
                label="URL"
                name="url"
                type="url"
                required
                placeholder="https://cdn.example.com/banner.jpg"
              />
              <SelectField
                label="Type"
                name="media_type"
                defaultValue="image"
                options={[
                  { value: "image", label: "Image" },
                  { value: "video", label: "Video" },
                  { value: "document", label: "Document" },
                  { value: "audio", label: "Audio" },
                ]}
              />
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
