"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";
import { useState } from "react";

const perks = [
  "14-day free trial, no credit card",
  "AI chatbots included",
  "Unlimited workflows",
  "Full CRM access",
  "Cancel anytime",
];

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);

  return (
    <div className="min-h-screen bg-[#050508] flex relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#00FF87]/5 rounded-full blur-[150px]" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#00D4FF]/5 rounded-full blur-[120px]" />

      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00FF87] to-[#00D4FF] flex items-center justify-center shadow-[0_0_24px_rgba(0,255,135,0.5)]">
            <Zap className="w-4 h-4 text-[#050508]" />
          </div>
          <span className="font-bold text-lg">WhatsFlow <span className="gradient-text-green">AI</span></span>
        </Link>

        <div className="space-y-8">
          <div>
            <h2 className="text-4xl font-black leading-tight mb-4">
              Start automating your WhatsApp{" "}
              <span className="gradient-text-green">business today</span>
            </h2>
            <p className="text-white/60 leading-relaxed">
              Join 50,000+ businesses using WhatsFlow AI to automate customer support,
              generate leads, and grow revenue on WhatsApp.
            </p>
          </div>

          <div className="space-y-3">
            {perks.map((perk) => (
              <div key={perk} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[#00FF87]/15 border border-[#00FF87]/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-3 h-3 text-[#00FF87]" />
                </div>
                <span className="text-sm text-white/70">{perk}</span>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="glass-card p-5">
            <p className="text-sm text-white/70 italic mb-4">
              "WhatsFlow AI helped us 3x our conversions in 30 days. The AI chatbot
              handles 90% of our customer queries automatically."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#00FF87]/20 flex items-center justify-center text-sm font-bold text-[#00FF87]">S</div>
              <div>
                <div className="text-xs font-semibold">Sarah Mitchell</div>
                <div className="text-xs text-white/40">Founder, StyleHouse</div>
              </div>
              <div className="ml-auto flex gap-0.5">
                {[1,2,3,4,5].map(s => <span key={s} className="text-yellow-400 text-xs">★</span>)}
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-white/30">
          © 2024 WhatsFlow AI · Privacy · Terms
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00FF87] to-[#00D4FF] flex items-center justify-center">
                <Zap className="w-4 h-4 text-[#050508]" />
              </div>
              <span className="font-bold text-lg">WhatsFlow <span className="gradient-text-green">AI</span></span>
            </Link>
          </div>

          <div className="glass-card p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold mb-2">Create your account</h1>
              <p className="text-white/50 text-sm">Start your 14-day free trial — no credit card needed</p>
            </div>

            {/* Form */}
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">First Name</label>
                  <input
                    type="text"
                    placeholder="Alex"
                    className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">Last Name</label>
                  <input
                    type="text"
                    placeholder="Johnson"
                    className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Work Email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Company Name</label>
                <input
                  type="text"
                  placeholder="Your Company Ltd."
                  className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Phone Number</label>
                <div className="flex gap-2">
                  <select className="bg-white/5 border border-white/12 rounded-xl px-3 py-3 text-sm text-white/70 focus:outline-none focus:border-[#00FF87]/50 transition-all w-24">
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+55">🇧🇷 +55</option>
                  </select>
                  <input
                    type="tel"
                    placeholder="555 0100"
                    className="flex-1 bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/50 transition-all pr-10"
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

              <div className="flex items-start gap-3 py-1">
                <input
                  type="checkbox"
                  id="terms"
                  className="mt-0.5 w-4 h-4 accent-[#00FF87]"
                />
                <label htmlFor="terms" className="text-xs text-white/50 leading-relaxed cursor-pointer">
                  I agree to the{" "}
                  <Link href="#" className="text-[#00FF87] hover:underline">Terms of Service</Link>{" "}
                  and{" "}
                  <Link href="#" className="text-[#00FF87] hover:underline">Privacy Policy</Link>
                </label>
              </div>

              <Link
                href="/dashboard"
                className="btn-primary w-full justify-center py-3.5 text-base"
              >
                Create Free Account
                <ArrowRight className="w-5 h-5" />
              </Link>
            </form>

            <p className="text-center text-sm text-white/50 mt-5">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-[#00FF87] font-medium hover:text-[#00CC6A] transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
