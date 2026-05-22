"use client";

import { motion } from "framer-motion";
import {
  Settings,
  Bell,
  Lock,
  CreditCard,
  Users,
  Globe,
  Zap,
  Smartphone,
  Save,
  Link,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";
import Header from "@/components/dashboard/Header";

const settingSections = [
  { id: "general", label: "General", icon: Settings },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "team", label: "Team", icon: Users },
  { id: "api", label: "API & Webhooks", icon: Globe },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("general");
  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <div className="bg-[#050508] min-h-full">
      <Header title="Settings" subtitle="Manage your account preferences and configuration" />

      <div className="p-6">
        <div className="flex gap-6">
          {/* Settings nav */}
          <div className="w-52 flex-shrink-0 space-y-1">
            {settingSections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeSection === s.id
                    ? "bg-[#00FF87]/10 text-[#00FF87] border border-[#00FF87]/20"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <s.icon className="w-4 h-4" />
                {s.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4 max-w-2xl">
            {activeSection === "general" && (
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-5">Business Profile</h3>
                  <div className="space-y-4">
                    {[
                      { label: "Business Name", value: "MyBusiness Inc.", type: "text" },
                      { label: "WhatsApp Phone", value: "+1 555 0100", type: "tel" },
                      { label: "Business Email", value: "hello@mybusiness.com", type: "email" },
                      { label: "Website", value: "https://mybusiness.com", type: "url" },
                    ].map((field) => (
                      <div key={field.label}>
                        <label className="block text-xs font-medium text-white/60 mb-1.5">{field.label}</label>
                        <input
                          type={field.type}
                          defaultValue={field.value}
                          className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00FF87]/50 transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-5">AI Preferences</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-white/60 mb-1.5">Default AI Model</label>
                      <select className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00FF87]/50 transition-all">
                        <option>GPT-4o (Recommended)</option>
                        <option>Claude 3.5 Sonnet</option>
                        <option>Gemini 1.5 Pro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-white/60 mb-1.5">Response Language</label>
                      <select className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#00FF87]/50 transition-all">
                        <option>Auto-detect (Recommended)</option>
                        <option>English</option>
                        <option>Spanish</option>
                        <option>Portuguese</option>
                        <option>Hindi</option>
                        <option>Arabic</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button className="btn-primary text-sm py-2.5 px-6">
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </motion.div>
            )}

            {activeSection === "api" && (
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="glass-card p-6">
                  <h3 className="font-semibold mb-2">API Keys</h3>
                  <p className="text-xs text-white/50 mb-5">Use these keys to access WhatsFlow AI from your applications</p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-white/60 mb-1.5">Live API Key</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type={showApiKey ? "text" : "password"}
                            defaultValue="wf_live_sk_1234567890abcdef1234567890abcdef"
                            readOnly
                            className="w-full bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none pr-10"
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
                          >
                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button className="px-4 py-3 rounded-xl bg-white/5 border border-white/12 text-sm text-white/70 hover:bg-white/10 transition-colors">
                          Copy
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white/60 mb-1.5">Webhook URL</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://your-server.com/webhook"
                          className="flex-1 bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/50 transition-all"
                        />
                        <button className="px-4 py-3 rounded-xl bg-white/5 border border-white/12 text-sm text-white/70 hover:bg-white/10 transition-colors">
                          <Link className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection !== "general" && activeSection !== "api" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-8 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  {settingSections.find(s => s.id === activeSection) && (
                    (() => {
                      const Section = settingSections.find(s => s.id === activeSection)!;
                      return <Section.icon className="w-6 h-6 text-white/40" />;
                    })()
                  )}
                </div>
                <h3 className="font-semibold mb-2 capitalize">{activeSection} Settings</h3>
                <p className="text-sm text-white/40">This section is ready and waiting for configuration.</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
