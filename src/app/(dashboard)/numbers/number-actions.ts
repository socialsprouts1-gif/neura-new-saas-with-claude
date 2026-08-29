"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { resolveConnection, listConnections } from "@/lib/connections";
import { getPhoneNumber, describeMetaError, MetaApiError } from "@/lib/meta-whatsapp";
import type { ActionResult } from "../actions";

// Managing the set of WhatsApp numbers in a workspace.
//
// The numbers themselves are created by the connect flow; this is what a
// person does with them afterwards — name them, pick which one is used by
// default, and ask Meta what it currently thinks of each.

function refreshScreens() {
  // Every screen that shows a number or a number picker has to re-read.
  for (const path of [
    "/numbers",
    "/integrations",
    "/inbox",
    "/chatbot",
    "/ai-assistant",
    "/campaigns",
  ]) {
    revalidatePath(path);
  }
}

/**
 * Asks Meta what this number is called and how it is rated, and stores it.
 *
 * Without this the app only knows the phone_number_id, so every screen
 * shows a 15-digit id nobody recognises instead of +91 92724 47307.
 */
export async function refreshNumber(id: string): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const connection = await resolveConnection(supabase, orgId, { connectionId: id });
  if ("error" in connection) return { ok: false, error: connection.error };

  try {
    const number = await getPhoneNumber(connection.phoneNumberId, connection.accessToken);

    await supabase
      .from("waba_connections")
      .update({
        display_phone_number: number.display_phone_number ?? null,
        verified_name: number.verified_name ?? null,
        quality_rating: number.quality_rating ?? null,
        last_checked_at: new Date().toISOString(),
        // Reaching Meta at all proves the credentials work, so any
        // recorded failure is stale.
        last_error: null,
        last_error_at: null,
      })
      .eq("id", id)
      .eq("org_id", orgId);

    refreshScreens();
    return {
      ok: true,
      message: `${number.display_phone_number ?? "This number"} is live${
        number.verified_name ? ` as "${number.verified_name}"` : ""
      }.`,
    };
  } catch (error) {
    const reason =
      error instanceof MetaApiError
        ? describeMetaError(error.status, error.body)
        : error instanceof Error
          ? error.message
          : "Meta did not answer.";

    await supabase
      .from("waba_connections")
      .update({ last_error: reason, last_error_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", orgId);

    refreshScreens();
    return { ok: false, error: reason };
  }
}

/** Refreshes every number, for the button at the top of the Numbers screen. */
export async function refreshAllNumbers(): Promise<ActionResult & { checked?: number }> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const connections = await listConnections(supabase, orgId);
  let failed = 0;

  for (const connection of connections) {
    const result = await refreshNumber(connection.id);
    if (!result.ok) failed += 1;
  }

  refreshScreens();
  return {
    ok: true,
    checked: connections.length,
    message:
      failed > 0
        ? `Checked ${connections.length}, ${failed} could not be reached.`
        : `Checked ${connections.length} number${connections.length === 1 ? "" : "s"}.`,
  };
}

/**
 * Chooses the number used when nothing more specific applies.
 *
 * The old default is cleared first: a unique index allows one per
 * workspace, so setting a second without clearing the first fails on the
 * constraint rather than switching.
 */
export async function setDefaultNumber(id: string): Promise<ActionResult> {
  const { orgId, role } = await requireOrg();
  if (role !== "owner" && role !== "admin") {
    return { ok: false, error: "Only owners and admins can change the default number." };
  }

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("waba_connections")
    .select("id, status")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!target) return { ok: false, error: "That number is not in this workspace." };
  if (target.status !== "active") {
    return { ok: false, error: "Only an active number can be the default." };
  }

  await supabase
    .from("waba_connections")
    .update({ is_default: false })
    .eq("org_id", orgId)
    .eq("is_default", true);

  const { error } = await supabase
    .from("waba_connections")
    .update({ is_default: true })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  refreshScreens();
  return { ok: true, message: "Default number updated." };
}

/** A name the team recognises: "Support", "Sales", "Test number". */
export async function renameNumber(id: string, label: string): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase
    .from("waba_connections")
    .update({ label: label.trim().slice(0, 40) || null })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  refreshScreens();
  return { ok: true, message: "Renamed." };
}

/** The things that can be pinned to one number. */
export type Pinnable = "chatbot" | "assistant" | "automation" | "campaign";

/**
 * Pins a bot, assistant or campaign to one number — or unpins it.
 *
 * Null means "any number", and it is the right default: a workspace that
 * has only ever had one number should not have to attach it to every bot
 * before anything replies.
 */
export async function setAutomationNumber(
  kind: Pinnable,
  id: string,
  connectionId: string | null
): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  if (connectionId) {
    const { data: owned } = await supabase
      .from("waba_connections")
      .select("id")
      .eq("id", connectionId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!owned) return { ok: false, error: "That number is not in this workspace." };
  }

  // Written out per table rather than through a lookup: each table has its
  // own Update type, and a computed table name collapses them to never.
  const patch = { connection_id: connectionId };
  const { error } =
    kind === "chatbot"
      ? await supabase.from("chatbot_flows").update(patch).eq("id", id).eq("org_id", orgId)
      : kind === "assistant"
        ? await supabase.from("ai_assistants").update(patch).eq("id", id).eq("org_id", orgId)
        : kind === "automation"
          ? await supabase.from("automation_flows").update(patch).eq("id", id).eq("org_id", orgId)
          : await supabase.from("campaigns").update(patch).eq("id", id).eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  refreshScreens();
  return { ok: true, message: connectionId ? "Number set." : "Now runs on any number." };
}
