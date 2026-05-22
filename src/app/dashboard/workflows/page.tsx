"use client";

import { motion } from "framer-motion";
import {
  Plus,
  Play,
  Pause,
  Copy,
  Trash2,
  GitBranch,
  Zap,
  MessageCircle,
  Clock,
  Filter,
  Users,
  MoreHorizontal,
  ArrowRight,
  CheckCircle,
  Bot,
  ShoppingCart,
  Bell,
} from "lucide-react";
import Header from "@/components/dashboard/Header";

const workflows = [
  {
    id: 1,
    name: "Welcome & Onboarding Flow",
    trigger: "New Contact Added",
    steps: 6,
    status: "Active",
    runs: 1247,
    lastRun: "2 min ago",
    color: "#00FF87",
    icon: Users,
    category: "Onboarding",
  },
  {
    id: 2,
    name: "Abandoned Cart Recovery",
    trigger: "Cart Abandoned > 1hr",
    steps: 4,
    status: "Active",
    runs: 892,
    lastRun: "8 min ago",
    color: "#00D4FF",
    icon: ShoppingCart,
    category: "Ecommerce",
  },
  {
    id: 3,
    name: "Lead Nurture Sequence",
    trigger: "Lead Qualified",
    steps: 8,
    status: "Active",
    runs: 2341,
    lastRun: "1 min ago",
    color: "#A855F7",
    icon: Bot,
    category: "Sales",
  },
  {
    id: 4,
    name: "Appointment Reminder",
    trigger: "24h Before Booking",
    steps: 3,
    status: "Active",
    runs: 456,
    lastRun: "5 min ago",
    color: "#F59E0B",
    icon: Bell,
    category: "Bookings",
  },
  {
    id: 5,
    name: "Payment Follow-up",
    trigger: "Invoice Overdue",
    steps: 5,
    status: "Paused",
    runs: 234,
    lastRun: "2 days ago",
    color: "#EC4899",
    icon: Clock,
    category: "Finance",
  },
];

const workflowNodes = [
  { label: "Trigger", icon: Zap, color: "#F59E0B", desc: "New Contact" },
  { label: "Send Message", icon: MessageCircle, color: "#00FF87", desc: "Welcome msg" },
  { label: "Wait 24h", icon: Clock, color: "#00D4FF", desc: "Delay node" },
  { label: "Check Reply", icon: Filter, color: "#A855F7", desc: "Condition" },
  { label: "AI Response", icon: Bot, color: "#00FF87", desc: "GPT-4o" },
  { label: "Tag Lead", icon: CheckCircle, color: "#00D4FF", desc: "CRM update" },
];

export default function WorkflowsPage() {
  return (
    <div className="bg-[#050508] min-h-full">
      <Header title="Workflow Automation" subtitle="Visual drag-and-drop automation builder" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Active Workflows", value: "24", color: "#00FF87" },
            { label: "Total Runs Today", value: "5,842", color: "#00D4FF" },
            { label: "Success Rate", value: "99.2%", color: "#A855F7" },
            { label: "Avg Completion", value: "2.4h", color: "#F59E0B" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass-card p-4"
            >
              <div className="text-2xl font-black mb-0.5" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-white/50">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="flex gap-2 flex-1 overflow-x-auto">
            {["All", "Active", "Paused", "Onboarding", "Sales", "Ecommerce"].map((t) => (
              <button
                key={t}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  t === "All"
                    ? "bg-[#00FF87]/10 text-[#00FF87] border border-[#00FF87]/20"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button className="btn-primary text-sm py-2 whitespace-nowrap">
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>

        {/* Workflow list */}
        <div className="space-y-3">
          {workflows.map((wf, i) => (
            <motion.div
              key={wf.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className="glass-card p-5 hover:border-white/20 transition-all duration-200 group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${wf.color}15`, border: `1px solid ${wf.color}25` }}
                >
                  <wf.icon className="w-6 h-6" style={{ color: wf.color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold group-hover:text-[#00FF87] transition-colors">
                          {wf.name}
                        </h3>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: `${wf.color}15`, color: wf.color }}
                        >
                          {wf.category}
                        </span>
                      </div>
                      <div className="text-xs text-white/50 mt-0.5">
                        Trigger: <span className="text-white/70">{wf.trigger}</span>
                        <span className="text-white/20 mx-2">·</span>
                        {wf.steps} steps
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
                          wf.status === "Active"
                            ? "bg-[#00FF87]/10 text-[#00FF87] border border-[#00FF87]/20"
                            : "bg-white/5 text-white/40 border border-white/10"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${wf.status === "Active" ? "bg-[#00FF87] animate-pulse" : "bg-white/30"}`} />
                        {wf.status}
                      </span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-6 mt-3">
                    <div className="text-xs text-white/50">
                      <span className="font-semibold text-white">{wf.runs.toLocaleString()}</span> runs
                    </div>
                    <div className="text-xs text-white/50">
                      Last: <span className="text-white/70">{wf.lastRun}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Edit">
                    <GitBranch className="w-4 h-4 text-white/60" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" title={wf.status === "Active" ? "Pause" : "Play"}>
                    {wf.status === "Active" ? (
                      <Pause className="w-4 h-4 text-[#F59E0B]" />
                    ) : (
                      <Play className="w-4 h-4 text-[#00FF87]" />
                    )}
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Duplicate">
                    <Copy className="w-4 h-4 text-white/60" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-red-500/10 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4 text-red-400/60" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Workflow preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold">Visual Flow Preview</h3>
              <p className="text-xs text-white/50">Welcome & Onboarding Flow</p>
            </div>
            <button className="btn-primary text-xs py-2 px-4">
              Open Builder
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Nodes */}
          <div className="flex items-center gap-0 overflow-x-auto pb-4">
            {workflowNodes.map((node, i) => (
              <div key={node.label} className="flex items-center flex-shrink-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.08 }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:border-white/30 transition-all cursor-pointer group"
                  style={{
                    background: `${node.color}08`,
                    borderColor: `${node.color}25`,
                    minWidth: 100,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: `${node.color}20`, border: `1px solid ${node.color}30` }}
                  >
                    <node.icon className="w-5 h-5" style={{ color: node.color }} />
                  </div>
                  <span className="text-xs font-semibold text-center">{node.label}</span>
                  <span className="text-[10px] text-white/40 text-center">{node.desc}</span>
                </motion.div>
                {i < workflowNodes.length - 1 && (
                  <div className="flex items-center px-2">
                    <div className="w-8 h-px bg-gradient-to-r from-white/20 to-white/5" />
                    <ArrowRight className="w-3 h-3 text-white/20 -ml-1" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
