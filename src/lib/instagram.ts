// Instagram, the parts that are just rules.
//
// Pure: no fetch, no env, no server-only, so the matching that decides
// whether a stranger gets an automated DM can be tested without a network
// and without an Instagram account.
//
// This is the "Instagram API with Instagram Login" path, not the older
// one that hangs off a Facebook Page. It matters for setup: the customer
// signs in with their Instagram credentials, the app has its own
// Instagram App ID separate from the Meta app id, and no Facebook Page
// has to exist at all.

/**
 * What the product asks a customer to agree to, and why each one.
 *
 * Asked for together because Meta reviews them together, and an app that
 * can read a comment but not answer it is an app that passes review and
 * does nothing.
 */
export const SCOPES = [
  // Who they are: the account id and username every other call needs.
  "instagram_business_basic",
  // Receiving and sending direct messages.
  "instagram_business_manage_messages",
  // Reading comments and replying to them, publicly or privately.
  "instagram_business_manage_comments",
] as const;

export const OAUTH_BASE = "https://www.instagram.com/oauth/authorize";

/**
 * Where the customer is sent to approve the connection.
 *
 * `state` carries the workspace, signed by the caller — without it the
 * callback has no idea which workspace just connected, and anybody who
 * knows the redirect URI could attach their own Instagram account to
 * somebody else's workspace.
 */
export function authoriseUrl(input: {
  instagramAppId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.instagramAppId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: SCOPES.join(","),
    state: input.state,
  });
  return `${OAUTH_BASE}?${params.toString()}`;
}

/**
 * What is wrong with the credentials, or null if nothing is.
 *
 * The values go into a query string that is handed to Instagram, so a
 * bad one does not fail here — it fails on Instagram's side as "Page
 * isn't available", which reads as a broken integration rather than a
 * mistyped setting.
 *
 * The shape worth catching is a whole block pasted into the value box:
 * `INSTAGRAM_APP_ID = 123\nINSTAGRAM_APP_SECRET = ...`. That one is not
 * merely broken — it puts the secret into a URL, and from there into
 * browser history and two sets of server logs.
 */
export function credentialProblem(appId: string, appSecret: string): string | null {
  if (!appId) {
    return "INSTAGRAM_APP_ID is not set. It is on the Instagram product page of your Meta app, and it is not the same as your Meta app id.";
  }
  if (!/^\d+$/.test(appId)) {
    return "INSTAGRAM_APP_ID has something other than the id in it — it should be just the digits, with no variable name, no equals sign and nothing on a second line. If a whole block was pasted into the value box then the app secret is in there too, and it needs resetting in Meta.";
  }
  if (!appSecret) return "INSTAGRAM_APP_SECRET is not set.";
  if (/\s/.test(appSecret)) {
    return "INSTAGRAM_APP_SECRET has whitespace in it, so it is probably more than the secret. It should be the secret on its own.";
  }
  return null;
}

/**
 * The redirect URI, which has to match what is in the App Dashboard
 * exactly — Meta compares the whole string, not the host.
 */
export function redirectUri(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}/api/instagram/connect/callback`;
}

/* ---------------------------------------------------------------------
   Comment rules
   --------------------------------------------------------------------- */

export interface CommentRule {
  id: string;
  name: string;
  keywords: string[];
  /** null means any post. */
  mediaId: string | null;
  dmMessage: string | null;
  publicReply: string | null;
  isActive: boolean;
}

export interface Comment {
  id: string;
  mediaId: string | null;
  text: string;
  /** The account's own id, so it can ignore itself. */
  fromId?: string | null;
}

function normalise(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/\s+/g, " ").trim();
}

/**
 * Whether a comment contains a keyword, on a word boundary.
 *
 * Substring matching is what makes a keyword bot embarrassing: a rule on
 * "hi" fires on "this", "shipping" and "Chicago". The boundary check is
 * the difference between a rule that answers people who said hi and one
 * that answers everybody.
 */
export function mentions(text: string, keyword: string): boolean {
  const needle = normalise(keyword);
  if (!needle) return false;
  const haystack = normalise(text);

  // Built from the normalised keyword, so a keyword with punctuation in
  // it ("20% off") cannot break the pattern.
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(haystack);
}

/**
 * The rule that answers a comment, or null.
 *
 * A rule pinned to one post beats a catch-all, for the same reason an
 * assistant pinned to a number does: naming the post is the operator
 * being specific, and a general rule quietly swallowing a specific one
 * is the setting that looks switched on and does nothing.
 *
 * An empty keyword list means every comment. That is a real campaign —
 * "DM everybody who comments on this post" — rather than a rule somebody
 * forgot to finish, which is why it is allowed and why it still has to
 * lose to a rule that named a keyword.
 */
export function ruleFor(comment: Comment, rules: readonly CommentRule[]): CommentRule | null {
  const live = rules.filter((rule) => rule.isActive);

  const applies = live.filter(
    (rule) => !rule.mediaId || (comment.mediaId && rule.mediaId === comment.mediaId)
  );

  const score = (rule: CommentRule) =>
    // Lower sorts first: a named post beats any post, and a named
    // keyword beats "every comment".
    (rule.mediaId ? 0 : 2) + (rule.keywords.length > 0 ? 0 : 1);

  const matched = applies.filter(
    (rule) =>
      rule.keywords.length === 0 || rule.keywords.some((word) => mentions(comment.text, word))
  );

  return matched.sort((a, b) => score(a) - score(b))[0] ?? null;
}

/** What is wrong with a rule, or null. */
export function ruleProblem(rule: {
  name: string;
  dmMessage?: string | null;
  publicReply?: string | null;
}): string | null {
  if (!rule.name.trim()) return "Give the rule a name so you can find it again.";
  if (!rule.dmMessage?.trim() && !rule.publicReply?.trim()) {
    return "A rule that neither sends a DM nor replies publicly does nothing. Fill in at least one.";
  }
  if ((rule.dmMessage ?? "").length > 950) {
    return "Instagram refuses a direct message over 1000 characters. Shorten it.";
  }
  return null;
}

/**
 * Whether a comment can still be privately replied to.
 *
 * Meta allows seven days. Worth checking before sending rather than
 * after: a refusal here is a row in the log saying "too old", and a
 * refusal from Meta is an error nobody can act on.
 */
export const PRIVATE_REPLY_WINDOW_DAYS = 7;

export function withinReplyWindow(commentedAt: string | Date, now: Date = new Date()): boolean {
  const at = commentedAt instanceof Date ? commentedAt : new Date(commentedAt);
  if (Number.isNaN(at.getTime())) return false;
  const days = (now.getTime() - at.getTime()) / 86_400_000;
  return days >= 0 && days <= PRIVATE_REPLY_WINDOW_DAYS;
}
