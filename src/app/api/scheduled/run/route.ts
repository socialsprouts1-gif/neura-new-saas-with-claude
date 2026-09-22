import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchScheduledMessages } from "@/lib/scheduled-dispatch";

// Letting the app push its own queue along.
//
// The daily cron is the backstop, not the mechanism. On Vercel's Hobby
// plan a cron may run once a day, so a message scheduled for a quarter
// past three would sit until the small hours — which is not what
// "delivered at the time you pick" means to anybody.
//
// So the app calls this every minute while somebody has it open, which
// for a business tool is most of the working day. Scoped to the caller's
// own workspace: a signed-in person may push their own queue and nobody
// else's.

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const ctx = await requireOrg();

  // Nothing here is destructive on its own — dispatch only sends messages
  // whose time has already passed, and each row is claimed before it goes,
  // so two tabs racing cannot double-send.
  const result = await dispatchScheduledMessages(new Date(), ctx.orgId);

  // Told back to the caller so it can slow down. A workspace that has
  // never scheduled anything should not be asking once a minute for ever.
  const { count } = await createAdminClient()
    .from("scheduled_messages")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.orgId)
    .eq("status", "pending");

  return NextResponse.json({ ...result, pending: count ?? 0 });
}
