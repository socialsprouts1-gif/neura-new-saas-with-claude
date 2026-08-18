import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "./_components/Sidebar";
import TopBar from "./_components/TopBar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let orgName = "Neura Chat";
  if (membership) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", membership.org_id)
      .maybeSingle();
    if (org) orgName = org.name;
  }

  return (
    <div className="flex h-screen bg-[#050508] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar orgName={orgName} userEmail={user.email ?? ""} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
