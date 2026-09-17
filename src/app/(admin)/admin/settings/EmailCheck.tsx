import { sendTestEmail } from "../actions";
import ActionForm, { Field } from "@/components/ui/ActionForm";
import Link from "next/link";
import { Card, Badge } from "@/components/ui/primitives";
import { emailTransportName, isEmailConfigured } from "@/lib/email";

/**
 * Proof that email works, without registering an account to find out.
 *
 * Every other way of testing this is slow and destructive: the welcome is
 * deduped per workspace, so the same signup cannot be reused, and each
 * attempt leaves a real account behind. Worse, a failure looked identical
 * whether the cause was a missing variable, a wrong password or an
 * un-migrated database — all three produce silence in a mailbox.
 */
export default function EmailCheck() {
  const configured = isEmailConfigured();
  const transport = emailTransportName();

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-center gap-2.5 mb-1">
        <h2 className="font-semibold">Email</h2>
        {configured ? (
          <Badge tone="green">sending over {transport}</Badge>
        ) : (
          <Badge tone="amber">not configured</Badge>
        )}
      </div>

      {configured ? (
        <>
          <p className="text-sm text-white/50 mb-4 leading-relaxed">
            Sends one real message now. If it arrives, welcome mail, trial reminders and payment
            receipts all use the same transport.
          </p>

          {/* The trap this screen used to walk people into. A Resend account
              with no verified domain delivers only to the address the
              account was opened with, so testing against your own inbox is
              testing the one address that cannot fail — and every real
              customer is refused. */}
          {transport === "resend" && (
            <p className="text-[11px] text-[#FACC15] mb-4 leading-relaxed">
              On Resend, a test to your own inbox proves less than it looks. Until a domain is
              verified at resend.com/domains, Resend delivers only to the address the account
              was opened with and refuses every customer address — a test arrives, a real signup
              does not. <Link href="/admin/emails" className="underline">The email log</Link>{" "}
              shows which of the two is happening.
            </p>
          )}
          <ActionForm action={sendTestEmail} submitLabel="Send a test">
            <Field
              label="Send to"
              name="to"
              type="email"
              required
              placeholder="you@example.com"
              hint="Use an address you can open right now — ideally not the one the Resend or SMTP account was opened with."
            />
          </ActionForm>
          <p className="text-[11px] text-white/35 mt-3 leading-relaxed">
            Whatever happens, it is recorded in{" "}
            <Link href="/admin/emails" className="underline hover:text-white/60">
              the email log
            </Link>{" "}
            along with what the provider said — including for mail nobody was watching, like a
            welcome that never arrived.
          </p>
        </>
      ) : (
        <p className="text-sm text-[#FACC15] leading-relaxed">
          Set <code className="text-white/70">EMAIL_FROM</code>, plus either{" "}
          <code className="text-white/70">RESEND_API_KEY</code> or all four{" "}
          <code className="text-white/70">SMTP_*</code> variables, then redeploy. Vercel does not
          apply new environment variables to a build that already exists, so saving them is not
          enough on its own.
        </p>
      )}
    </Card>
  );
}
