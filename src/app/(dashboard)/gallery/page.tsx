import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { saveMediaAsset } from "../portal-actions";
import ActionForm, { Field, SelectField } from "@/components/ui/ActionForm";
import GalleryBrowser from "./GalleryBrowser";
import { PageHeader, Card, StatCard, EmptyState } from "@/components/ui/primitives";
import type { MediaAsset } from "@/types/portal";

export default async function GalleryPage() {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const { data: assets, error } = await supabase
    .from("media_assets")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const all = (assets ?? []) as MediaAsset[];
  const counts = {
    image: all.filter((a) => a.media_type === "image").length,
    video: all.filter((a) => a.media_type === "video").length,
    document: all.filter((a) => a.media_type === "document").length,
  };
  const stored = all.reduce((total, a) => total + (a.size_bytes ?? 0), 0);

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Gallery"
        subtitle="Upload once, send many times. Every file gets a public URL you can paste into a Send Media Message node, a template, or a campaign."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Files" value={all.length} />
        <StatCard label="Images" value={counts.image} />
        <StatCard label="Video &amp; docs" value={counts.video + counts.document} />
        <StatCard label="Stored" value={formatTotal(stored)} />
      </div>

      {error ? (
        <EmptyState
          title="Couldn't load media"
          description={`${error.message}. If this mentions a missing relation or column, run supabase/setup.sql again — uploads added a storage bucket and a column.`}
        />
      ) : (
        <GalleryBrowser assets={all} orgId={orgId} />
      )}

      <Card className="mt-6">
        <h2 className="font-semibold mb-1">Link a file hosted somewhere else</h2>
        <p className="text-sm text-white/50 mb-5 max-w-2xl">
          If the file already lives on your own CDN or site, add it by URL instead of uploading a
          second copy. Meta fetches media anonymously, so the address has to be publicly reachable
          over HTTPS — deleting one of these only removes it from this list, never from your host.
        </p>
        <div className="max-w-md">
          <ActionForm action={saveMediaAsset} submitLabel="Add by URL" resetOnSuccess>
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
        </div>
      </Card>
    </div>
  );
}

function formatTotal(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
