import SetupNotice from "@/components/SetupNotice";

// Every authenticated surface redirects here when Supabase credentials are
// absent, so the "not configured" state has one destination instead of each
// layout rendering its own copy.
export default function SetupPage() {
  return <SetupNotice />;
}
