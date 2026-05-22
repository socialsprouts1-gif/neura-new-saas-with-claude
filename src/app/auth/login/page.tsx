"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Zap, Eye, EyeOff, ArrowRight, GitFork } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#00FF87]/6 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00FF87] to-[#00D4FF] flex items-center justify-center shadow-[0_0_30px_rgba(0,255,135,0.5)]">
              <Zap className="w-5 h-5 text-[#050508]" />
            </div>
            <span className="font-bold text-xl">
              WhatsFlow <span className="gradient-text-green">AI</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
            <p className="text-white/50 text-sm">Sign in to your WhatsFlow AI account</p>
          </div>

          {/* Social login */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm font-medium hover:border-white/25 hover:bg-white/8 transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/15 bg-white/5 text-sm font-medium hover:border-white/25 hover:bg-white/8 transition-all">
              <GitFork className="w-4 h-4" />
              GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/40">or continue with email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Form */}
          <form className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1.5">Email Address</label>
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/50 focus:bg-[#00FF87]/3 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-white/70">Password</label>
                <Link href="#" className="text-xs text-[#00FF87] hover:text-[#00CC6A] transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/50 focus:bg-[#00FF87]/3 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-white/40 hover:text-white/70"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="btn-primary w-full justify-center mt-2"
            >
              Sign In
              <ArrowRight className="w-4 h-4" />
            </Link>
          </form>

          <p className="text-center text-sm text-white/50 mt-6">
            Don't have an account?{" "}
            <Link href="/auth/register" className="text-[#00FF87] hover:text-[#00CC6A] font-medium transition-colors">
              Start free trial
            </Link>
          </p>
        </div>

        {/* Trust signal */}
        <p className="text-center text-xs text-white/30 mt-6">
          🔒 Enterprise-grade security · SOC2 · GDPR compliant
        </p>
      </motion.div>
    </div>
  );
}
