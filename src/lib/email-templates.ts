// What the emails say.
//
// Pure, so the wording can be tested and so nothing here can accidentally
// reach a mailbox from a unit test. Every message is built in both HTML
// and plain text: a text part is what keeps a message out of the spam
// folder and readable in a client that refuses HTML, and writing it as an
// afterthought is how it ends up empty.
//
// Deliberately plain markup. Inline styles only, no images, no external
// stylesheet, a single column — because Gmail strips <style> blocks,
// Outlook ignores most of what survives, and a layout that needs either
// one is a layout that breaks in the client most businesses actually use.

export interface EmailBody {
  subject: string;
  html: string;
  text: string;
}

export interface EmailBrand {
  /** "Neura Chat". */
  name: string;
  /** Where the buttons point, with no trailing slash. */
  appUrl: string;
  /** Who replies go to. */
  supportEmail: string;
  /**
   * An absolute https URL to the logo, or null for the wordmark.
   *
   * Absolute because a mail client has no page to resolve a relative path
   * against, and public because it is fetched by Gmail's image proxy with
   * no session — an image behind a login renders as a broken box in every
   * inbox that receives it.
   */
  logoUrl?: string | null;
  /**
   * Where the footer's unsubscribe points, when the message is one that
   * may be refused. Unset on account mail, which has no unsubscribe.
   *
   * A header alone is not enough: it only reaches people whose client
   * renders it as a button. Somebody who cannot find a way out marks the
   * message as spam instead, which costs far more than losing them.
   */
  unsubscribeUrl?: string | null;
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The shell every message shares.
 *
 * `preheader` is the line a mail client shows next to the subject in the
 * list. Left unset it takes whatever text comes first, which is usually
 * the logo's alt text or a greeting — so it is set deliberately and then
 * hidden, which is the standard trick and the only way to control it.
 */
function layout(
  brand: EmailBrand,
  preheader: string,
  body: string,
  action?: { label: string; href: string }
): string {
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td style="border-radius:10px;background:#00E08F;">
        <a href="${escape(action.href)}" style="display:inline-block;padding:13px 26px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#06251A;text-decoration:none;border-radius:10px;">${escape(action.label)}</a>
      </td></tr></table>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F4F6F8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:14px;padding:36px 32px;font-family:Helvetica,Arial,sans-serif;">
    <tr><td style="padding-bottom:22px;">${header(brand)}</td></tr>
    <tr><td style="font-size:15px;line-height:1.65;color:#25303F;">${body}${button}</td></tr>
    <tr><td style="padding-top:26px;border-top:1px solid #E6EAEF;font-size:12px;line-height:1.6;color:#8894A5;">
      Questions? Reply to this email or write to
      <a href="mailto:${escape(brand.supportEmail)}" style="color:#8894A5;">${escape(brand.supportEmail)}</a>.${
        brand.unsubscribeUrl
          ? `<br><a href="${escape(brand.unsubscribeUrl)}" style="color:#8894A5;text-decoration:underline;">Unsubscribe from these reminders</a>`
          : ""
      }
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/**
 * The logo, or the name set in type when there is none.
 *
 * Height is set in the style and the width left to scale, because Outlook
 * ignores CSS height on an image and needs the attribute — giving both a
 * fixed value is what squashes a logo whose aspect ratio is not exactly
 * what was guessed here.
 *
 * The alt text is the brand name, not "logo": images are off by default in
 * a good share of inboxes, and what should appear in that space is the
 * company's name rather than the word logo.
 */
function header(brand: EmailBrand): string {
  const logo = brand.logoUrl?.trim();
  if (!logo || !/^https:\/\//i.test(logo)) {
    return `<span style="font-size:17px;font-weight:700;color:#0B1220;">${escape(brand.name)}</span>`;
  }

  return `<img src="${escape(logo)}" alt="${escape(brand.name)}" height="32" style="height:32px;width:auto;max-width:180px;border:0;outline:none;text-decoration:none;display:block;">`;
}

function plain(lines: string[], action?: { label: string; href: string }): string {
  const body = lines.filter(Boolean).join("\n\n");
  return action ? `${body}\n\n${action.label}: ${action.href}` : body;
}

const p = (text: string) => `<p style="margin:0 0 14px;">${text}</p>`;

/** "3 days" / "1 day" / "today", for a sentence rather than a number. */
export function inDays(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

// --- the messages ---------------------------------------------------------

export function welcomeEmail(brand: EmailBrand, input: { trialDays: number }): EmailBody {
  const action = { label: "Open the dashboard", href: `${brand.appUrl}/overview` };
  const lines = [
    "Your workspace is ready.",
    `You have ${input.trialDays} days free — every feature, no card needed. Connect a WhatsApp number to start.`,
    "The fastest first step is Integrations → Connect WhatsApp. It takes about two minutes.",
  ];

  return {
    subject: `Welcome to ${brand.name}`,
    html: layout(brand, `${input.trialDays} days free, starting now.`, lines.map(p).join(""), action),
    text: plain(lines, action),
  };
}

export function trialEndingEmail(brand: EmailBrand, input: { daysLeft: number }): EmailBody {
  const when = inDays(input.daysLeft);
  const action = { label: "See plans", href: `${brand.appUrl}/billing` };
  const lines = [
    `Your free trial ends ${when}.`,
    "Pick a plan to keep your number connected, your automations running and your history where it is. Nothing is deleted if you do not — it simply stops sending.",
  ];

  return {
    subject:
      input.daysLeft <= 0
        ? `Your ${brand.name} trial ends today`
        : `Your ${brand.name} trial ends ${when}`,
    html: layout(brand, `Choose a plan to keep sending.`, lines.map(p).join(""), action),
    text: plain(lines, action),
  };
}

export function trialExpiredEmail(
  brand: EmailBrand,
  input: { fromPrice?: string | null } = {}
): EmailBody {
  const action = { label: "Pick a plan and pay", href: `${brand.appUrl}/billing` };
  const lines = [
    "Your free trial has ended, and sending is paused.",
    "Your workspace, your contacts and every conversation are exactly where you left them. Nothing has been deleted.",
    input.fromPrice
      ? `Plans start at ${input.fromPrice}. Paying takes a minute and everything starts again immediately.`
      : "Choose a plan and everything picks up where it stopped.",
  ];

  return {
    subject: `Your ${brand.name} trial has ended`,
    html: layout(brand, "Your data is safe. Pick a plan to carry on.", lines.map(p).join(""), action),
    text: plain(lines, action),
  };
}

/**
 * The reminders after that, on a schedule that slows down.
 *
 * Written to be readable the tenth time as well as the first, which means
 * no escalation and no invented deadline. Somebody who has not paid after
 * a month has not forgotten — they have decided, and a message that keeps
 * insisting otherwise is the one that gets marked as spam.
 */
export function trialFollowUpEmail(
  brand: EmailBrand,
  input: { step: number; daysSince: number; fromPrice?: string | null }
): EmailBody {
  const action = { label: "See plans", href: `${brand.appUrl}/billing` };

  // Three angles, cycled, so a sequence of ten does not read as one
  // message sent ten times.
  const openings = [
    "Your workspace is still here whenever you want it back.",
    "Your contacts and chat history are still saved — nothing has been removed.",
    "Still thinking it over? Your account is exactly as you left it.",
  ];

  const lines = [
    openings[input.step % openings.length],
    input.fromPrice
      ? `Plans start at ${input.fromPrice}, monthly, and you can cancel any time.`
      : "Pick a plan whenever you are ready; you can cancel any time.",
    "If Neura Chat is not right for you, just ignore this — no reply needed.",
  ];

  return {
    subject: `Your ${brand.name} workspace is waiting`,
    html: layout(brand, "Nothing has been deleted.", lines.map(p).join(""), action),
    text: plain(lines, action),
  };
}

/**
 * The first bot. Worth marking, because it is the moment the product
 * stops being a signup and starts being a thing that does work.
 */
export function firstChatbotEmail(brand: EmailBrand, input: { botName: string }): EmailBody {
  const name = input.botName.trim() || "your first bot";
  const action = { label: "Open the builder", href: `${brand.appUrl}/chatbot` };
  const lines = [
    `You've built ${escape(name)} — your first chatbot.`,
    "Switch it on and it answers customers on WhatsApp without you, day or night. Anything it cannot handle lands in your inbox with the whole conversation attached, so nobody is left waiting.",
    "Worth doing next: send yourself a message on the connected number and watch it reply. It is the fastest way to see what a customer will see.",
  ];

  return {
    subject: `Your first chatbot is ready`,
    html: layout(brand, "Switch it on and it answers for you.", lines.map(p).join(""), action),
    text: plain(lines, action),
  };
}

export function paymentReceivedEmail(
  brand: EmailBrand,
  input: { planName: string; amount: string; renewsOn: string; interval: string }
): EmailBody {
  const action = { label: "Go to billing", href: `${brand.appUrl}/billing` };
  const lines = [
    `Payment received — you're on ${input.planName}.`,
    `${input.amount} paid. Renews on ${input.renewsOn}, ${input.interval}.`,
    "Everything on the plan is available now. The receipt is on your billing page whenever you need it.",
  ];

  return {
    subject: `Payment received — ${input.planName}`,
    html: layout(brand, `${input.amount} received. ${input.planName} is active.`, lines.map(p).join(""), action),
    text: plain(lines, action),
  };
}

export function renewalReminderEmail(
  brand: EmailBrand,
  input: { planName: string; daysLeft: number; renewsOn: string }
): EmailBody {
  const when = inDays(input.daysLeft);
  const action = { label: "Review billing", href: `${brand.appUrl}/billing` };
  const lines = [
    `Your ${input.planName} plan renews ${when}, on ${input.renewsOn}.`,
    "Nothing is needed from you — this is just so the charge is not a surprise. You can change or cancel the plan before then from your billing page.",
  ];

  return {
    subject: `${input.planName} renews ${when}`,
    // No preheader about paying: this is a courtesy, and a subject line
    // that reads like a demand for money on a plan already paid for is
    // how a working product starts feeling like a debt collector.
    html: layout(brand, `A heads-up, nothing to do.`, lines.map(p).join(""), action),
    text: plain(lines, action),
  };
}

export function subscriptionExpiredEmail(
  brand: EmailBrand,
  input: { planName: string | null }
): EmailBody {
  const plan = input.planName ? `Your ${input.planName} plan` : "Your plan";
  const action = { label: "Renew now", href: `${brand.appUrl}/billing` };
  const lines = [
    `${plan} has ended and sending is paused.`,
    "Your number stays connected and nothing has been deleted. Renew and it starts sending again straight away.",
  ];

  return {
    subject: `${plan} has ended`,
    html: layout(brand, "Sending is paused. Renew to start again.", lines.map(p).join(""), action),
    text: plain(lines, action),
  };
}
