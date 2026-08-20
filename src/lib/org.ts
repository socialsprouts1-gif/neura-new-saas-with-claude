import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { OrgRole } from "@/types/database";

export interface OrgContext {
  user: User;
  orgId: string;
  orgName: string;
  role: OrgRole;
  isPlatformAdmin: boolean;
}

// Resolves the signed-in user's organisation once per request. Pages call
// this instead of re-deriving membership, so the tenant boundary is
// established in exactly one place.
export async function requireOrg(): Promise<OrgContext> {
  // Next renders pages in parallel with their layout, so a layout-level
  // guard does not stop this from running. Check here too, or an
  // unconfigured deployment throws during prerender instead of redirecting.
  if (!isSupabaseConfigured()) redirect("/setup");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/auth/login?error=No+organization+found+for+this+account");

  const [{ data: org }, { data: adminRow }] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", membership.org_id).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    user,
    orgId: membership.org_id,
    orgName: org?.name ?? "Neura Chat",
    role: membership.role,
    isPlatformAdmin: Boolean(adminRow),
  };
}

// Platform staff only. Membership of an org is irrelevant here — the sole
// grant is a platform_admins row.
export async function requirePlatformAdmin(): Promise<User> {
  if (!isSupabaseConfigured()) redirect("/setup");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) redirect("/inbox");

  return user;
}
