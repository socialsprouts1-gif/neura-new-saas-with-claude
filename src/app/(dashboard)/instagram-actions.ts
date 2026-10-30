"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireFeature } from "@/lib/org";
import { ruleProblem } from "@/lib/instagram";
import type { ActionResult } from "@/app/(dashboard)/actions";

// Everything that changes a comment rule goes through requireFeature,
// which resolves the workspace from the session rather than trusting an
// org id from the browser — these rules decide who gets messaged, so a
// workspace being able to write another's would be the whole game.

export interface RuleInput {
  id?: string;
  name: string;
  keywords: string;
  mediaId: string;
  dmMessage: string;
  publicReply: string;
  connectionId: string | null;
}

/**
 * Keywords as typed, split into a list.
 *
 * Comma or newline, because people type both and insisting on one is a
 * form that silently makes a single keyword out of "price, cost, rate".
 */
function keywordList(raw: string): string[] {
  return [...new Set(raw.split(/[,\n]/).map((word) => word.trim()).filter(Boolean))];
}

export async function saveCommentRule(input: RuleInput): Promise<ActionResult> {
  const { orgId } = await requireFeature("instagram");

  const draft = {
    name: input.name.trim(),
    dmMessage: input.dmMessage.trim() || null,
    publicReply: input.publicReply.trim() || null,
  };

  const problem = ruleProblem(draft);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  // updated_at is insert-only by default and settable on update, so the
  // two payloads differ by that one field rather than being spread.
  const fields = {
    name: draft.name,
    keywords: keywordList(input.keywords),
    media_id: input.mediaId.trim() || null,
    dm_message: draft.dmMessage,
    public_reply: draft.publicReply,
    connection_id: input.connectionId,
  };

  const { error } = input.id
    ? await supabase
        .from("instagram_comment_rules")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .eq("org_id", orgId)
    : await supabase.from("instagram_comment_rules").insert({ ...fields, org_id: orgId });

  if (error) {
    if (error.code === "42P01") {
      return {
        ok: false,
        error:
          "The Instagram tables do not exist yet. Run supabase/updates/run-me-latest.sql in the SQL editor.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/instagram");
  return { ok: true, message: input.id ? "Saved." : `"${draft.name}" is live.` };
}

export async function setCommentRuleActive(
  id: string,
  active: boolean
): Promise<ActionResult> {
  const { orgId } = await requireFeature("instagram");

  const supabase = await createClient();
  const { error } = await supabase
    .from("instagram_comment_rules")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/instagram");
  return { ok: true, message: active ? "Switched on." : "Switched off." };
}

export async function deleteCommentRule(id: string): Promise<ActionResult> {
  const { orgId } = await requireFeature("instagram");

  const supabase = await createClient();
  const { error } = await supabase
    .from("instagram_comment_rules")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/instagram");
  return { ok: true, message: "Deleted. Comments it would have answered are left alone." };
}
