"use server";

import { createClient } from "@/lib/supabase/server";
import { normaliseWaNumber } from "@/lib/whatsapp-link";
import { sendPlatformEvent } from "@/lib/platform-message";

// Saying hello on WhatsApp, to somebody who just signed up for WhatsApp.
//
// The work happens in sendPlatformEvent, which every one of the
// platform's own messages goes through. This is the thin part: it decides
// who the recipient is, and it takes no arguments in order to do that —
// the number comes from the signed-in user's own metadata, so a caller
// cannot use this to send a template to an arbitrary number.

export interface WelcomeResult {
  sent: boolean;
  reason?: string;
}

export async function sendSignupWelcome(): Promise<WelcomeResult> {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return { sent: false, reason: "Not signed in" };

    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const raw =
      typeof metadata.whatsapp_number === "string"
        ? metadata.whatsapp_number
        : typeof metadata.phone === "string"
          ? metadata.phone
          : "";

    const waId = normaliseWaNumber(raw);
    if (!waId) return { sent: false, reason: "No WhatsApp number on this account" };

    return await sendPlatformEvent("signup", {
      waId,
      name: typeof metadata.full_name === "string" ? metadata.full_name : null,
    });
  } catch (error) {
    // Logged, never surfaced as a sign-up failure: the account exists and
    // the person is already through the door.
    console.error("Could not send the sign-up welcome", error);
    return { sent: false, reason: "Unknown failure" };
  }
}

/**
 * Records the WhatsApp number of somebody who already had an account.
 *
 * Every customer from before sign-up asked for a number has none, so none
 * of them can be sent anything. The sign-in form asks once, and this is
 * where the answer lands — only ever onto the caller's own account, and
 * only when it is still empty, so a typo at a shared machine cannot
 * overwrite a number that was already right.
 */
export async function saveMyWhatsAppNumber(
  input: string
): Promise<{ ok: boolean; error?: string }> {
  const waId = normaliseWaNumber(input ?? "");
  if (!waId) {
    return { ok: false, error: "That number does not look right. Include the country code." };
  }

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return { ok: false, error: "Sign in first." };

    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const existing = normaliseWaNumber(
      typeof metadata.whatsapp_number === "string" ? metadata.whatsapp_number : ""
    );
    if (existing) return { ok: true };

    const { error } = await supabase.auth.updateUser({
      data: { ...metadata, whatsapp_number: waId, phone: waId },
    });
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (error) {
    console.error("Could not save a WhatsApp number", error);
    return { ok: false, error: "That could not be saved just now." };
  }
}
