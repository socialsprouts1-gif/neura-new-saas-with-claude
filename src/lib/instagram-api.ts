import "server-only";
import { encryptToken } from "@/lib/crypto";
import { credentialProblem, redirectUri, SCOPES } from "@/lib/instagram";

// Talking to Instagram.
//
// Separate from instagram.ts so the rules that decide whether a stranger
// gets an automated DM stay testable without a network, and everything
// that needs a secret stays on the server.
//
// Two bases, and they are not interchangeable. The OAuth exchange goes to
// api.instagram.com; everything afterwards goes to graph.instagram.com.
// Sending a graph call to the first returns a cheerful 200 with an error
// body, which is the kind of thing that costs an afternoon.

const OAUTH_API = "https://api.instagram.com";
const GRAPH = "https://graph.instagram.com/v23.0";

export interface InstagramEnv {
  appId: string;
  appSecret: string;
  appUrl: string;
}

/**
 * The credentials, or a sentence saying which one is missing.
 *
 * The Instagram app id is NOT the Meta app id — it is its own value on
 * the Instagram product page of the dashboard, and using the wrong one
 * fails at the consent screen with an error that does not say so.
 */
export function instagramEnv(): InstagramEnv | { error: string } {
  // Trimmed before checking: a trailing newline in the value box is
  // invisible on the Vercel screen and fatal in a query string.
  const appId = process.env.INSTAGRAM_APP_ID?.trim() ?? "";
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim() ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://neurachat.in";

  const problem = credentialProblem(appId, appSecret);
  if (problem) return { error: problem };
  return { appId, appSecret, appUrl };
}

export function isInstagramConfigured(): boolean {
  return !("error" in instagramEnv());
}

export interface ConnectedAccount {
  igUserId: string;
  username: string | null;
  accountName: string | null;
  profilePictureUrl: string | null;
  /** Already encrypted — the plaintext never leaves this module. */
  accessTokenEncrypted: string;
  expiresAt: string | null;
}

/**
 * Code in, a connected account out.
 *
 * Three calls, because Instagram's first token is useless on its own: the
 * short-lived one lasts an hour, so it is immediately traded for the
 * sixty-day one. Storing the short one would mean every customer's
 * automation silently stopped an hour after they set it up.
 */
export async function exchangeCode(
  code: string,
  env: InstagramEnv
): Promise<ConnectedAccount | { error: string }> {
  const form = new URLSearchParams({
    client_id: env.appId,
    client_secret: env.appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(env.appUrl),
    code,
  });

  const shortLived = await fetch(`${OAUTH_API}/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  }).then((response) => response.json().catch(() => null));

  const shortToken: string | undefined = shortLived?.access_token;
  if (!shortToken) {
    return { error: described(shortLived, "Instagram refused the sign-in.") };
  }

  const long = await fetch(
    `${GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(
      env.appSecret
    )}&access_token=${encodeURIComponent(shortToken)}`
  ).then((response) => response.json().catch(() => null));

  // Falling back to the short-lived token rather than failing: the
  // connection works for an hour and the refresh job can fix it, which
  // beats telling somebody who just approved everything that it failed.
  const token: string = long?.access_token ?? shortToken;
  const expiresIn: number | null =
    typeof long?.expires_in === "number" ? long.expires_in : null;

  const me = await fetch(
    `${GRAPH}/me?fields=user_id,username,name,profile_picture_url&access_token=${encodeURIComponent(token)}`
  ).then((response) => response.json().catch(() => null));

  const igUserId: string | undefined = me?.user_id ?? shortLived?.user_id;
  if (!igUserId) return { error: described(me, "Instagram did not say which account was connected.") };

  return {
    igUserId: String(igUserId),
    username: me?.username ?? null,
    accountName: me?.name ?? null,
    profilePictureUrl: me?.profile_picture_url ?? null,
    accessTokenEncrypted: encryptToken(token),
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
  };
}

/** A direct message to somebody who has messaged first. */
export async function sendDirectMessage(input: {
  igUserId: string;
  recipientId: string;
  text: string;
  token: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return post(`${GRAPH}/${input.igUserId}/messages`, input.token, {
    recipient: { id: input.recipientId },
    message: { text: input.text },
  });
}

/**
 * A private reply to a comment.
 *
 * The recipient is the *comment id*, not the person — which is the one
 * genuinely surprising thing about this API. Replying to the commenter's
 * user id instead fails, because outside the 24-hour window there is no
 * conversation with them yet; the comment is what grants permission.
 */
export async function sendPrivateReply(input: {
  igUserId: string;
  commentId: string;
  text: string;
  token: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return post(`${GRAPH}/${input.igUserId}/messages`, input.token, {
    recipient: { comment_id: input.commentId },
    message: { text: input.text },
  });
}

/** A public reply under the comment. */
export async function replyToComment(input: {
  commentId: string;
  text: string;
  token: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return post(`${GRAPH}/${input.commentId}/replies`, input.token, { message: input.text });
}

async function post(
  url: string,
  token: string,
  body: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (response.ok) return { ok: true };
    const detail = await response.json().catch(() => null);
    return { ok: false, error: described(detail, `Instagram refused it (${response.status}).`) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Instagram was unreachable." };
  }
}

/** Meta's own words where there are any, because ours are a guess. */
function described(payload: unknown, fallback: string): string {
  const record = payload as { error?: { message?: string }; error_message?: string } | null;
  return record?.error?.message ?? record?.error_message ?? fallback;
}

export { SCOPES };
