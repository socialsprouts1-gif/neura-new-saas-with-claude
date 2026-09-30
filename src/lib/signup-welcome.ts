// The settings behind "send every new sign-up a WhatsApp welcome".
//
// Pure by design: no fetch, no env, no server-only, so it can be tested.
//
// A person who signs up for a WhatsApp automation product and hears
// nothing on WhatsApp has been shown the product not working. The message
// has to be a template, because a brand-new contact has never written in
// and the 24-hour service window is therefore shut — free-form text to
// them is refused by Meta every time.
//
// It goes out on the platform's own number, not the customer's: at the
// moment they sign up they have not connected one.

export interface WelcomeSettings {
  enabled: boolean;
  /** The workspace whose WhatsApp connection sends it — the platform's own. */
  orgId: string;
  /** Which of that workspace's numbers. Empty means its default. */
  connectionId: string;
  /** An approved template on that number. */
  templateName: string;
  language: string;
  /**
   * Whether the template takes the person's name as its one variable.
   * A template declaring one variable sent none is refused for every
   * recipient with 132000, and a template declaring none sent one is
   * refused just as hard, so this has to match what Meta holds.
   */
  usesName: boolean;
}

export const DEFAULT_WELCOME: WelcomeSettings = {
  enabled: false,
  orgId: "",
  connectionId: "",
  templateName: "",
  language: "en",
  usesName: false,
};

/** Reads the stored JSON, filling anything missing with a safe default. */
export function readWelcome(value: unknown): WelcomeSettings {
  const raw = (value ?? {}) as Record<string, unknown>;
  const text = (key: string) => {
    const found = raw[key];
    return typeof found === "string" ? found.trim() : "";
  };

  return {
    // Off unless explicitly turned on. A half-configured welcome that
    // tries to send is one Meta error per sign-up.
    enabled: raw.enabled === true,
    orgId: text("org_id"),
    connectionId: text("connection_id"),
    templateName: text("template_name"),
    language: text("language") || DEFAULT_WELCOME.language,
    usesName: raw.uses_name === true,
  };
}

/** The shape written back to platform_settings. */
export function writeWelcome(settings: WelcomeSettings): Record<string, unknown> {
  return {
    enabled: settings.enabled,
    org_id: settings.orgId,
    connection_id: settings.connectionId,
    template_name: settings.templateName,
    language: settings.language,
    uses_name: settings.usesName,
  };
}

/**
 * Whether these settings can actually send, and what is missing if not.
 *
 * Returning the reason rather than a boolean because this is shown to the
 * person configuring it: "not set up" tells them nothing about which of
 * the four fields they left blank.
 */
export function welcomeProblem(settings: WelcomeSettings): string | null {
  if (!settings.enabled) return null;
  if (!settings.orgId) return "Choose the workspace whose WhatsApp number sends the welcome.";
  if (!settings.templateName) return "Name the approved template to send.";
  if (!/^[a-z0-9_]+$/.test(settings.templateName)) {
    return "A template name is lowercase letters, digits and underscores — copy it exactly from WhatsApp Manager.";
  }
  if (!settings.language) return "Give the template's language, such as en or en_US.";
  return null;
}

export function canSendWelcome(settings: WelcomeSettings): boolean {
  return settings.enabled && welcomeProblem(settings) === null;
}

/**
 * The template parameters for one recipient.
 *
 * Empty unless the template declares a variable, because Meta counts them
 * and refuses a mismatch outright — the same 132000 that broke every
 * campaign until the named-variable fix.
 */
export interface WelcomeComponent {
  type: "body";
  parameters: Array<Record<string, unknown>>;
}

export function welcomeComponents(
  settings: WelcomeSettings,
  name: string
): WelcomeComponent[] {
  if (!settings.usesName) return [];
  // Never blank: Meta refuses an empty parameter, and "there" reads as a
  // greeting rather than as a missing value.
  const value = (name ?? "").trim() || "there";
  return [{ type: "body", parameters: [{ type: "text", text: value }] }];
}

/** The first name, for a greeting. "Vivek Sharma" should not say "Hi Vivek Sharma". */
export function greetingName(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  return first;
}
