import "server-only";

import { createClient } from "@/lib/supabase/server";
import { buildSiteContent, DEFAULT_SITE_CONTENT, type SiteContent } from "@/lib/site-content";

/**
 * The landing page's content, defaults where nothing is saved.
 *
 * Never throws and never returns nothing. The marketing site is the first
 * thing anyone sees, and a database that is unreachable, unmigrated or empty
 * has to render it exactly as before rather than showing a blank page — so
 * every failure here falls through to the defaults.
 */
export async function loadSiteContent(): Promise<SiteContent> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("site_content").select("key, value");
    if (error || !data) return DEFAULT_SITE_CONTENT;
    return buildSiteContent(data);
  } catch {
    return DEFAULT_SITE_CONTENT;
  }
}
