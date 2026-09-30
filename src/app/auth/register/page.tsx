"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import BrandMark from "@/components/ui/BrandMark";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_PARAM, authNextFor } from "@/lib/plan-checkout";
import { normaliseWaNumber } from "@/lib/whatsapp-link";
import { sendSignupWelcome } from "../welcome-actions";
import { describeClaim, claimGuestCheckout } from "../claim-actions";
import { splitName } from "@/lib/guest-checkout";

const perks = [
  "AI-ready WhatsApp automation",
  "Direct Meta Cloud API — no BSP markup",
  "Unlimited team members",
  "Multi-tenant from day one",
];

function RegisterForm() {
  const router = useRouter();
  // The plan chosen on the pricing page. Validated on the billing side
  // against the plans that exist — here it is only carried.
  const params = useSearchParams();
  const plan = params.get(PLAN_PARAM);

  // Arrived from the payment window: the plan is already bought, and this
  // form exists only to put a login on it. Everything the gateway asked
  // for is filled in, so all that is left is a password.
  const claim = params.get("claim");
  const [claimed, setClaimed] = useState<{
    planName: string;
    bonus: string;
  } | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    if (!claim) return;
    let live = true;

    void describeClaim(claim).then((found) => {
      if (!live) return;
      if (!found.ok) {
        setClaimError(found.error);
        return;
      }
      const name = splitName(found.contact.name);
      setFirstName((current) => current || name.first);
      setLastName((current) => current || name.last);
      setEmail((current) => current || found.contact.email);
      setPhone((current) => current || found.contact.phone);
      setClaimed({ planName: found.planName, bonus: "" });
    });

    return () => {
      live = false;
    };
  }, [claim]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // The number is what the welcome message goes to, and what the
    // workspace's own WhatsApp number is matched against later. A typo
    // here is a welcome message that silently never arrives, so it is
    // checked before the account exists rather than after.
    const waId = normaliseWaNumber(phone);
    if (!waId) {
      setError("That WhatsApp number does not look right. Include the country code, or enter a 10-digit Indian number.");
      setLoading(false);
      return;
    }

    let data;
    try {
      const supabase = createClient();
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Carries the chosen plan through the confirmation email, so
          // the link lands on payment rather than losing the choice
          // somewhere between the pricing page and the inbox.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            authNextFor(plan)
          )}`,
          data: {
            full_name: `${firstName} ${lastName}`.trim(),
            org_name: companyName || undefined,
            // Stored on the user so the welcome template can be sent, and
            // so support can reach somebody on the number they signed up
            // with rather than only by email.
            whatsapp_number: waId,
            phone: waId,
          },
        },
      });

      if (result.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }
      data = result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setLoading(false);
      return;
    }

    setLoading(false);

    // With email confirmation enabled (the default), signUp doesn't return
    // a session yet — the org/org_members trigger still runs immediately
    // since it fires on the auth.users insert, not on confirmation.
    if (!data.session) {
      setCheckEmail(true);
      return;
    }

    // They already paid. Awaited, unlike the welcome message, because the
    // page they are about to land on shows their plan and would otherwise
    // show them the trial they have just paid to skip.
    if (claim) {
      const applied = await claimGuestCheckout(claim);
      if (!applied.ok && applied.error) {
        // The money is taken and the account exists, so this is a note to
        // act on rather than a sign-up failure to report.
        console.error(applied.error);
      }
    }

    // Hello on WhatsApp, to somebody who just signed up for WhatsApp
    // automation. Deliberately not awaited before moving on: the account
    // exists, and a message that could not be sent must not leave a new
    // customer staring at a spinner. It does nothing unless platform staff
    // have configured a template under Admin.
    void sendSignupWelcome();

    router.push(claim ? "/overview" : authNextFor(plan));
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) setError(oauthError.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent2/5 rounded-full blur-[120px]" />

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size={40} />
          <span className="font-bold text-lg">Neura <span className="gradient-text-green">Chat</span></span>
        </Link>

        <div className="space-y-8">
          <div>
            <h2 className="text-4xl font-black leading-tight mb-4">
              Automate WhatsApp on{" "}
              <span className="gradient-text-green">your own Meta credentials</span>
            </h2>
            <p className="text-white/60 leading-relaxed">
              Neura Chat connects straight to the Meta WhatsApp Cloud API — no
              third-party BSP in between.
            </p>
          </div>

          <div className="space-y-3">
            {perks.map((perk) => (
              <div key={perk} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-3 h-3 text-accent-ink" />
                </div>
                <span className="text-sm text-white/70">{perk}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/30">
          © 2026 Neura Chat · A Neuraxine product
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex justify-center mb-6 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <BrandMark size={40} />
              <span className="font-bold text-lg">Neura <span className="gradient-text-green">Chat</span></span>
            </Link>
          </div>

          <div className="glass-card p-8">
            {checkEmail ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-accent-ink" />
                </div>
                <h1 className="text-xl font-bold mb-2">Check your email</h1>
                <p className="text-white/50 text-sm">
                  We sent a confirmation link to <span className="text-white/80">{email}</span>.
                  Your organization is already set up — confirm your email to sign in.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  {claimed ? (
                    <>
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/12 border border-accent/25 text-accent-ink text-xs font-semibold mb-3">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Payment received — {claimed.planName}
                      </span>
                      <h1 className="text-2xl font-bold mb-2">Almost there</h1>
                      <p className="text-white/50 text-sm">
                        Your plan is paid for. Pick a password and your workspace is ready.
                      </p>
                    </>
                  ) : (
                    <>
                      <h1 className="text-2xl font-bold mb-2">Create your account</h1>
                      <p className="text-white/50 text-sm">Spin up your Neura Chat organization</p>
                    </>
                  )}
                  {claimError && (
                    <p className="text-sm text-[#FACC15]/85 mt-3 leading-relaxed">{claimError}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm font-medium hover:border-white/25 hover:bg-white/8 transition-all mb-6"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-white/40">or continue with email</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1.5">First Name</label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Alex"
                        className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white/70 mb-1.5">Last Name</label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Johnson"
                        className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">Work Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                      WhatsApp number
                    </label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 87675 12569"
                      autoComplete="tel"
                      className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all"
                    />
                    <p className="text-[12px] text-white/40 mt-1.5">
                      We send your setup guide here. A 10-digit Indian number is fine.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">Company Name</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your Company Ltd."
                      className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent/50 transition-all pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && <p className="text-sm text-red-400">{error}</p>}

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full justify-center py-3.5 text-base disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
                    {!loading && <ArrowRight className="w-5 h-5" />}
                  </button>
                </form>

                <p className="text-center text-sm text-white/50 mt-5">
                  Already have an account?{" "}
                  <Link href="/auth/login" className="text-accent-ink font-medium hover:text-[#00CC6A] transition-colors">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * useSearchParams makes the tree under it client-rendered, and a statically
 * prerendered route has to say where that starts. Without this the
 * production build fails outright on this page — it works in development,
 * where every route is rendered on demand, which is exactly how it got
 * missed.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--app-bg)]" />}>
      <RegisterForm />
    </Suspense>
  );
}
