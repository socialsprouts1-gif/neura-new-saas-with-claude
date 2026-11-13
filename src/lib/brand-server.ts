import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hostKey, slugFromHost, type BrandIdentity } from "@/lib/brand";

// Resolving the request's brand, once per request.
//
// React's cache() rather than a module variable: a module variable is
// shared by every request the server is handling at that moment, which on
// a white-label product means one customer's logo appearing on another
// agency's login page. cache() is scoped to the single render.
//
// Never throws. A database that is unreachable, unmigrated, or has no
// brands at all has to serve the platform's own front door exactly as
// before — the alternative is that adding white label takes the whole
// product down for everybody who is not using it.

/**
 * The platform's own domain, for the acme.<root> fallback addresses.
 *
 * Set in Vercel. Without it, only exact custom-domain matches work, which
 * is a smaller feature but never a wrong one.
 */
const ROOT_DOMAIN = process.env.PLATFORM_ROOT_DOMAIN ?? "";

/** The brand this request belongs to, or null for the platform's own. */
export const currentBrand = cache(async (): Promise<BrandIdentity | null> => {
  try {
    const host = hostKey((await headers()).get("host"));
    if (!host) return null;

    const slug = ROOT_DOMAIN ? slugFromHost(host, ROOT_DOMAIN) : null;

    // Nothing to look up: this is the platform's own domain, or an
    // address that names no brand.
    if (!slug && !host.includes(".")) return null;

    const supabase = await createClient();

    // One query for both ways in. The domain match wins when a brand has
    // somehow matched on both, because the custom domain is the one the
    // customer actually typed.
    const { data, error } = await supabase
      .from("brands")
      .select(
        "id, slug, domain, name, name_accent, logo_url, favicon_url, accent_hex, site_title, site_description, support_email, support_whatsapp"
      )
      .or(slug ? `domain.eq.${host},slug.eq.${slug}` : `domain.eq.${host}`)
      .eq("is_active", true)
      .limit(2);

    if (error || !data || data.length === 0) return null;

    const row = data.find((entry) => entry.domain === host) ?? data[0];

    return {
      id: row.id,
      slug: row.slug,
      domain: row.domain,
      name: row.name,
      nameAccent: row.name_accent ?? "",
      logoUrl: row.logo_url ?? "",
      faviconUrl: row.favicon_url ?? "",
      accentHex: row.accent_hex ?? "",
      siteTitle: row.site_title ?? "",
      siteDescription: row.site_description ?? "",
      supportEmail: row.support_email ?? "",
      supportWhatsapp: row.support_whatsapp ?? "",
    };
  } catch {
    // Including the case where there is no brands table yet, which is
    // every deployment that has not run the database update.
    return null;
  }
});
