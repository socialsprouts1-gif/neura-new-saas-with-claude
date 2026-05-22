"use client";

import { motion } from "framer-motion";
import {
  Plus,
  Send,
  Clock,
  CheckCircle,
  PauseCircle,
  BarChart3,
  Users,
  Eye,
  MousePointer,
  MoreHorizontal,
  Megaphone,
  Filter,
} from "lucide-react";
import Header from "@/components/dashboard/Header";

const campaigns = [
  {
    id: 1,
    name: "Summer Sale 2024",
    status: "Live",
    type: "Broadcast",
    sent: 12450,
    delivered: 12230,
    opened: 9180,
    clicked: 3420,
    created: "May 15, 2026",
    color: "#00FF87",
  },
  {
    id: 2,
    name: "Welcome Series — New Users",
    status: "Active",
    type: "Drip",
    sent: 4820,
    delivered: 4750,
    opened: 3600,
    clicked: 1240,
    created: "May 10, 2026",
    color: "#00D4FF",
  },
  {
    id: 3,
    name: "Abandoned Cart Recovery",
    status: "Active",
    type: "Trigger",
    sent: 2310,
    delivered: 2290,
    opened: 1890,
    clicked: 920,
    created: "May 8, 2026",
    color: "#A855F7",
  },
  {
    id: 4,
    name: "Flash Deal — 24 Hours",
    status: "Scheduled",
    type: "Broadcast",
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    created: "May 20, 2026",
    color: "#F59E0B",
  },
  {
    id: 5,
    name: "Re-engagement Campaign",
    status: "Paused",
    type: "Drip",
    sent: 8900,
    delivered: 8740,
    opened: 5200,
    clicked: 1800,
    created: "Apr 28, 2026",
    color: "#EC4899",
  },
];

const statusStyle: Record<string, { bg: string; color: string; icon: typeof CheckCircle }> = {
  Live: { bg: "rgba(0,255,135,0.1)", color: "#00FF87", icon: CheckCircle },
  Active: { bg: "rgba(0,212,255,0.1)", color: "#00D4FF", icon: CheckCircle },
  Scheduled: { bg: "rgba(245,158,11,0.1)", color: "#F59E0B", icon: Clock },
  Paused: { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", icon: PauseCircle },
};

function CampaignStat({ icon: Icon, label, value, color }: { icon: typeof Send; label: string; value: string | number; color: string }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="text-sm font-bold">{typeof value === "number" ? value.toLocaleString() : value}</div>
      <div className="text-[10px] text-white/40">{label}</div>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <div className="bg-[#050508] min-h-full">
      <Header title="Campaigns" subtitle="Create and manage WhatsApp broadcast campaigns" />

      <div className="p-6 space-y-6">
        {/* Top stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Campaigns", value: "48", icon: Megaphone, color: "#00FF87" },
            { label: "Messages Sent", value: "248K", icon: Send, color: "#00D4FF" },
            { label: "Avg Open Rate", value: "74.2%", icon: Eye, color: "#A855F7" },
            { label: "Avg Click Rate", value: "28.5%", icon: MousePointer, color: "#F59E0B" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card p-4 flex items-center gap-4"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color}15`, border: `1px solid ${s.color}25` }}
              >
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-white/50">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 flex gap-2">
            {["All", "Live", "Scheduled", "Drip", "Paused"].map((tab) => (
              <button
                key={tab}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === "All"
                    ? "bg-[#00FF87]/10 text-[#00FF87] border border-[#00FF87]/20"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:border-white/20 transition-colors">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="btn-primary text-sm py-2">
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>

        {/* Campaigns list */}
        <div className="space-y-3">
          {campaigns.map((c, i) => {
            const style = statusStyle[c.status];
            const StatusIcon = style.icon;
            const openRate = c.sent > 0 ? Math.round((c.opened / c.sent) * 100) : 0;
            const clickRate = c.sent > 0 ? Math.round((c.clicked / c.sent) * 100) : 0;

            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="glass-card p-5 hover:border-white/20 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer group"
              >
                <div className="flex items-center gap-5">
                  {/* Color indicator */}
                  <div
                    className="w-1 h-12 rounded-full flex-shrink-0"
                    style={{ background: c.color }}
                  />

                  {/* Campaign info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold group-hover:text-[#00FF87] transition-colors">
                          {c.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-white/40">{c.type}</span>
                          <span className="text-white/20">·</span>
                          <span className="text-xs text-white/40">{c.created}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}30` }}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {c.status}
                        </span>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10">
                          <MoreHorizontal className="w-4 h-4 text-white/60" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  {c.sent > 0 && (
                    <div className="hidden md:grid grid-cols-4 gap-6 flex-shrink-0">
                      <CampaignStat icon={Send} label="Sent" value={c.sent} color={c.color} />
                      <CampaignStat icon={CheckCircle} label="Delivered" value={c.delivered} color={c.color} />
                      <CampaignStat icon={Eye} label={`${openRate}% Open`} value={c.opened} color={c.color} />
                      <CampaignStat icon={MousePointer} label={`${clickRate}% Click`} value={c.clicked} color={c.color} />
                    </div>
                  )}
                  {c.sent === 0 && (
                    <div className="hidden md:flex items-center px-6">
                      <span className="text-sm text-white/30 italic">Awaiting send time...</span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {c.sent > 0 && (
                  <div className="mt-4 ml-5">
                    <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
                      <span>Delivery rate</span>
                      <span>{Math.round((c.delivered / c.sent) * 100)}%</span>
                    </div>
                    <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(c.delivered / c.sent) * 100}%`, background: c.color }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
