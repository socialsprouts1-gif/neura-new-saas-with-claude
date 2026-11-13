import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/org";
import { addBrandOwner, removeBrandOwner, saveBrand } from "../brand-actions";
import ActionForm, { Field } from "@/components/ui/ActionForm";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui/primitives";
import { toBrandRow } from "@/lib/brand-access";

// White-label front doors.
//
// A brand is a domain, a name and a logo in front of the same backend.
// Everything the customer touches is the product as it has always been —
// the same database, the same WhatsApp connection, the same isolation
// between workspaces. What changes is whose name is on it.
//
// The platform owner creates a brand and decides two things an agency
// never may: which domain it answers on, and who owns it. The agency then
// edits its own look at /agency, because an agency that has to email
// somebody to change its logo does not feel like it owns anything.

export const dynamic = "force-dynamic";

const ROOT_DOMAIN = process.env.PLATFORM_ROOT_DOMAIN ?? "";

export default async function AdminBrandsPage() {
  await requirePlatformAdmin();

  // The admin client throughout: brands has no write policies at all by
  // design, and counting another tenant's workspaces is exactly what the
  // tenant policies exist to prevent.
  const admin = createAdminClient();

  const [{ data: brandRows, error }, { data: orgRows }, { data: ownerRows }] = await Promise.all([
    admin.from("brands").select("*").order("created_at"),
    admin.from("organizations").select("id, brand_id"),
    admin.from("brand_owners").select("brand_id, user_id"),
  ]);

  const brands = (brandRows ?? []).map((row) => toBrandRow(row as Record<string, unknown>));

  const workspaces = new Map<string, number>();
  for (const org of orgRows ?? []) {
    if (!org.brand_id) continue;
    workspaces.set(org.brand_id, (workspaces.get(org.brand_id) ?? 0) + 1);
  }

  // Owner emails, looked up once rather than per brand.
  const ownerIds = [...new Set((ownerRows ?? []).map((row) => row.user_id))];
  const emails = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    for (const user of users?.users ?? []) {
      if (ownerIds.includes(user.id)) emails.set(user.id, user.email ?? user.id);
    }
  }

  const ownersByBrand = new Map<string, Array<{ userId: string; email: string }>>();
  for (const row of ownerRows ?? []) {
    const list = ownersByBrand.get(row.brand_id) ?? [];
    list.push({ userId: row.user_id, email: emails.get(row.user_id) ?? row.user_id });
    ownersByBrand.set(row.brand_id, list);
  }

  const unbranded = (orgRows ?? []).filter((org) => !org.brand_id).length;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="White-label brands"
        subtitle="Agency front doors. Same backend, same isolation between workspaces — a different name, logo and domain on the outside."
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="order-2 lg:order-1 space-y-4">
          {error ? (
            <EmptyState
              title="Couldn't load brands"
              description={`${error.message} — if this mentions a missing table, run supabase/updates/run-me-latest.sql.`}
            />
          ) : brands.length === 0 ? (
            <EmptyState
              title="No brands yet"
              description="Create one on the right. Until then every workspace signs up on your own domain, under your own name, exactly as now."
            />
          ) : (
            brands.map((brand) => {
              const owners = ownersByBrand.get(brand.id) ?? [];
              return (
                <Card key={brand.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-semibold">
                          {brand.name}
                          {brand.nameAccent && (
                            <span className="text-accent-ink">{brand.nameAccent}</span>
                          )}
                        </h3>
                        <Badge tone={brand.isActive ? "green" : "grey"}>
                          {brand.isActive ? "live" : "off"}
                        </Badge>
                        {brand.accentHex && (
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                            style={{ background: brand.accentHex }}
                            title={brand.accentHex}
                          />
                        )}
                      </div>

                      <div className="text-xs text-white/50 mt-1.5 space-y-0.5">
                        <p>
                          Address:{" "}
                          <span className="text-white/75 font-mono">
                            {brand.domain ?? `${brand.slug}.${ROOT_DOMAIN || "your-domain.com"}`}
                          </span>
                          {!brand.domain && (
                            <span className="text-white/35"> — no custom domain yet</span>
                          )}
                        </p>
                        <p>
                          <span className="text-white/75">
                            {workspaces.get(brand.id) ?? 0}
                          </span>{" "}
                          workspace{(workspaces.get(brand.id) ?? 0) === 1 ? "" : "s"} signed up
                          through it
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Owners — the people who may edit this brand at /agency. */}
                  <div className="rounded-2xl border border-white/10 bg-white/3 p-3.5 mb-3">
                    <p className="text-xs font-medium text-white/70 mb-2">Agency logins</p>
                    {owners.length === 0 ? (
                      <p className="text-xs text-white/40 mb-2.5">
                        Nobody yet. The agency signs up normally first, then you add their email
                        here.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 mb-2.5">
                        {owners.map((owner) => (
                          <li
                            key={owner.userId}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span className="text-white/70 truncate">{owner.email}</span>
                            <ActionForm
                              action={removeBrandOwner}
                              submitLabel="Remove"
                              compact
                              variant="quiet"
                            >
                              <input type="hidden" name="brand_id" value={brand.id} />
                              <input type="hidden" name="user_id" value={owner.userId} />
                            </ActionForm>
                          </li>
                        ))}
                      </ul>
                    )}
                    <ActionForm action={addBrandOwner} submitLabel="Add" compact resetOnSuccess>
                      <input type="hidden" name="brand_id" value={brand.id} />
                      <Field label="" name="email" type="email" placeholder="agency@example.com" />
                    </ActionForm>
                  </div>

                  <ActionForm action={saveBrand} submitLabel="Save">
                    <input type="hidden" name="id" value={brand.id} />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Field label="Name" name="name" defaultValue={brand.name} required />
                      <Field
                        label="Short name (web address)"
                        name="slug"
                        defaultValue={brand.slug}
                        required
                        hint={`Used for ${brand.slug}.${ROOT_DOMAIN || "your-domain.com"}`}
                      />
                      <Field
                        label="Custom domain"
                        name="domain"
                        defaultValue={brand.domain ?? ""}
                        placeholder="app.theiragency.com"
                        hint="Just the domain. Add it in Vercel too, or it will not answer."
                      />
                      <label className="flex items-center gap-2.5 text-sm self-end pb-2.5">
                        <input
                          type="checkbox"
                          name="is_active"
                          defaultChecked={brand.isActive}
                          className="w-4 h-4 accent-[var(--accent)]"
                        />
                        <span className="text-white/70">Live</span>
                      </label>
                    </div>
                  </ActionForm>
                </Card>
              );
            })
          )}
        </div>

        <div className="order-1 lg:order-2 space-y-4">
          <Card>
            <h2 className="font-semibold mb-1">New brand</h2>
            <p className="text-sm text-white/50 mb-5">
              The agency edits its own logo, colour and support details afterwards at{" "}
              <span className="font-mono text-white/70">/agency</span>.
            </p>
            <ActionForm action={saveBrand} submitLabel="Create brand" resetOnSuccess>
              <div className="space-y-4">
                <Field label="Name" name="name" required placeholder="Acme Chat" />
                <Field
                  label="Short name"
                  name="slug"
                  required
                  placeholder="acme"
                  hint={`Gives them ${"acme"}.${ROOT_DOMAIN || "your-domain.com"} straight away`}
                />
                <Field
                  label="Custom domain"
                  name="domain"
                  placeholder="app.acmeagency.com"
                  hint="Optional. Can be added later."
                />
                <input type="hidden" name="is_active" value="on" />
              </div>
            </ActionForm>
          </Card>

          <Card>
            <h2 className="font-semibold mb-2">Your own customers</h2>
            <p className="text-sm text-white/55 leading-relaxed">
              <span className="text-white/85 font-semibold">{unbranded}</span> workspace
              {unbranded === 1 ? "" : "s"} belong to you directly — everyone who signed up on your
              own domain. Nothing about them changes.
            </p>
          </Card>

          <Card>
            <h2 className="font-semibold mb-2">Before a custom domain works</h2>
            <ol className="text-xs text-white/55 space-y-2 leading-relaxed list-decimal pl-4">
              <li>The agency points their domain at Vercel with a CNAME.</li>
              <li>You add that domain to this project in Vercel → Settings → Domains.</li>
              <li>You paste it in the brand above.</li>
            </ol>
            <p className="text-xs text-white/40 mt-3 leading-relaxed">
              The{" "}
              <span className="font-mono text-white/60">
                name.{ROOT_DOMAIN || "your-domain.com"}
              </span>{" "}
              address needs none of that — add the wildcard{" "}
              <span className="font-mono text-white/60">*.{ROOT_DOMAIN || "your-domain.com"}</span>{" "}
              in Vercel once and every brand gets one for free.
            </p>
            {!ROOT_DOMAIN && (
              <p className="text-xs text-[#FACC15]/85 mt-3 leading-relaxed">
                Set <span className="font-mono">PLATFORM_ROOT_DOMAIN</span> in Vercel to turn those
                free addresses on. Until then only custom domains answer.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
