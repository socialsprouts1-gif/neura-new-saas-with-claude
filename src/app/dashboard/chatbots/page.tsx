"use client";

import { motion } from "framer-motion";
import {
  Bot,
  Plus,
  MessageCircle,
  Brain,
  Zap,
  Settings,
  Play,
  Pause,
  MoreHorizontal,
  Upload,
  Globe,
  FileText,
  CheckCircle,
  ArrowUpRight,
} from "lucide-react";
import Header from "@/components/dashboard/Header";

const chatbots = [
  {
    id: 1,
    name: "Customer Support Bot",
    model: "GPT-4o",
    status: "Active",
    chats: 2847,
    resolved: 94,
    trained: ["Product FAQ", "Return Policy", "Shipping Guide"],
    color: "#00FF87",
    description: "Handles all tier-1 support queries automatically",
  },
  {
    id: 2,
    name: "Lead Qualification AI",
    model: "Claude 3.5",
    status: "Active",
    chats: 1243,
    resolved: 87,
    trained: ["Sales Scripts", "Product Info", "Pricing FAQ"],
    color: "#00D4FF",
    description: "Qualifies leads and books demos automatically",
  },
  {
    id: 3,
    name: "E-Commerce Assistant",
    model: "Gemini 1.5",
    status: "Paused",
    chats: 4521,
    resolved: 91,
    trained: ["Product Catalog", "Order Tracking", "Payment FAQ"],
    color: "#A855F7",
    description: "Helps customers browse, order, and track purchases",
  },
];

const knowledgeSources = [
  { type: "PDF", name: "Product Catalog 2024.pdf", size: "2.4 MB", status: "Trained", icon: FileText, color: "#00FF87" },
  { type: "URL", name: "help.company.com", size: "142 pages", status: "Trained", icon: Globe, color: "#00D4FF" },
  { type: "FAQ", name: "Customer FAQ Sheet", size: "48 Q&As", status: "Training", icon: MessageCircle, color: "#A855F7" },
  { type: "PDF", name: "Return Policy.pdf", size: "180 KB", status: "Trained", icon: FileText, color: "#F59E0B" },
];

export default function ChatbotsPage() {
  return (
    <div className="bg-[#050508] min-h-full">
      <Header title="AI Chatbots" subtitle="Build, train, and deploy AI-powered WhatsApp chatbots" />

      <div className="p-6 space-y-6">
        {/* Chatbot cards */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Your Chatbots</h2>
          <button className="btn-primary text-sm py-2">
            <Plus className="w-4 h-4" />
            Create Chatbot
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {chatbots.map((bot, i) => (
            <motion.div
              key={bot.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-5 hover:border-white/20 transition-all duration-200 hover:-translate-y-1 group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${bot.color}15`, border: `1px solid ${bot.color}25` }}
                >
                  <Bot className="w-6 h-6" style={{ color: bot.color }} />
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: bot.status === "Active" ? "rgba(0,255,135,0.1)" : "rgba(255,255,255,0.05)",
                      color: bot.status === "Active" ? "#00FF87" : "rgba(255,255,255,0.4)",
                      border: `1px solid ${bot.status === "Active" ? "rgba(0,255,135,0.25)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${bot.status === "Active" ? "bg-[#00FF87] animate-pulse" : "bg-white/30"}`} />
                    {bot.status}
                  </span>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10">
                    <MoreHorizontal className="w-4 h-4 text-white/60" />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold mb-1">{bot.name}</h3>
              <p className="text-xs text-white/50 mb-3">{bot.description}</p>

              {/* Model badge */}
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium mb-4"
                style={{ background: `${bot.color}10`, color: bot.color, border: `1px solid ${bot.color}20` }}
              >
                <Brain className="w-3 h-3" />
                {bot.model}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold">{bot.chats.toLocaleString()}</div>
                  <div className="text-[10px] text-white/50">Chats Handled</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold" style={{ color: bot.color }}>{bot.resolved}%</div>
                  <div className="text-[10px] text-white/50">Resolved by AI</div>
                </div>
              </div>

              {/* Trained on */}
              <div className="mb-4">
                <div className="text-[10px] text-white/40 mb-2 uppercase tracking-wider">Trained on</div>
                <div className="flex flex-wrap gap-1">
                  {bot.trained.map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-white/8">
                <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 transition-colors">
                  <Settings className="w-3.5 h-3.5" />
                  Configure
                </button>
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: `${bot.color}15`, color: bot.color }}
                >
                  {bot.status === "Active" ? (
                    <><Pause className="w-3.5 h-3.5" /> Pause</>
                  ) : (
                    <><Play className="w-3.5 h-3.5" /> Resume</>
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Knowledge Base */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold">Knowledge Base</h3>
              <p className="text-xs text-white/50 mt-0.5">Documents used to train your AI chatbots</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-white/20 text-sm text-white/60 hover:border-[#00FF87]/40 hover:text-[#00FF87] transition-all">
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </div>

          <div className="space-y-3">
            {knowledgeSources.map((src, i) => (
              <motion.div
                key={src.name}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.07 }}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/3 hover:bg-white/6 transition-colors border border-white/6 group cursor-pointer"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${src.color}15`, border: `1px solid ${src.color}25` }}
                >
                  <src.icon className="w-5 h-5" style={{ color: src.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{src.name}</div>
                  <div className="text-xs text-white/40">{src.size} · {src.type}</div>
                </div>
                <span
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                  style={
                    src.status === "Trained"
                      ? { background: "rgba(0,255,135,0.1)", color: "#00FF87", border: "1px solid rgba(0,255,135,0.25)" }
                      : { background: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.25)" }
                  }
                >
                  {src.status === "Trained" ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border-2 border-[#F59E0B] border-t-transparent animate-spin" />
                  )}
                  {src.status}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
