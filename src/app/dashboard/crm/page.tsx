"use client";

import { motion } from "framer-motion";
import {
  Search,
  Filter,
  Plus,
  Star,
  Phone,
  Mail,
  MoreHorizontal,
  TrendingUp,
  Users,
  Target,
  ChevronRight,
} from "lucide-react";
import Header from "@/components/dashboard/Header";

const leads = [
  { id: 1, name: "Alex Thompson", company: "TechCorp Inc.", email: "alex@techcorp.com", phone: "+1 555 0101", stage: "Qualified", score: 92, value: "$12,000", tags: ["Hot Lead", "Enterprise"], avatar: "A", color: "#00FF87" },
  { id: 2, name: "Maria Santos", company: "Fashion Store", email: "maria@fashion.com", phone: "+55 11 9999", stage: "Demo Scheduled", score: 78, value: "$4,500", tags: ["Ecommerce"], avatar: "M", color: "#00D4FF" },
  { id: 3, name: "James Wilson", company: "Health Clinic", email: "james@clinic.com", phone: "+44 20 1234", stage: "Proposal Sent", score: 65, value: "$8,000", tags: ["Healthcare", "Warm"], avatar: "J", color: "#A855F7" },
  { id: 4, name: "Priya Gupta", company: "EduTech Startup", email: "priya@edutech.io", phone: "+91 98765", stage: "Negotiation", score: 88, value: "$15,000", tags: ["Hot Lead", "SaaS"], avatar: "P", color: "#F59E0B" },
  { id: 5, name: "Chris Lee", company: "Real Estate Co", email: "chris@realestate.com", phone: "+65 9123", stage: "Closed Won", score: 100, value: "$25,000", tags: ["Enterprise", "Won"], avatar: "C", color: "#00FF87" },
  { id: 6, name: "Emma Davis", company: "Marketing Agency", email: "emma@agency.com", phone: "+1 555 0202", stage: "New Lead", score: 45, value: "$3,000", tags: ["Agency", "Cold"], avatar: "E", color: "#EC4899" },
];

const stages = [
  { name: "New Lead", count: 24, color: "#F59E0B" },
  { name: "Qualified", count: 18, color: "#00D4FF" },
  { name: "Demo Scheduled", count: 12, color: "#A855F7" },
  { name: "Proposal Sent", count: 8, color: "#EC4899" },
  { name: "Negotiation", count: 5, color: "#00FF87" },
  { name: "Closed Won", count: 32, color: "#00FF87" },
];

const stageColor: Record<string, string> = {
  "New Lead": "#F59E0B",
  "Qualified": "#00D4FF",
  "Demo Scheduled": "#A855F7",
  "Proposal Sent": "#EC4899",
  "Negotiation": "#00FF87",
  "Closed Won": "#00FF87",
};

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{score}</span>
    </div>
  );
}

export default function CRMPage() {
  return (
    <div className="bg-[#050508] min-h-full">
      <Header title="CRM & Leads" subtitle="Manage your pipeline and track conversions" />

      <div className="p-6 space-y-6">
        {/* Pipeline stages */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {stages.map((stage, i) => (
            <motion.div
              key={stage.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass-card p-4 hover:border-white/20 transition-all cursor-pointer text-center"
            >
              <div className="text-2xl font-black mb-1" style={{ color: stage.color }}>
                {stage.count}
              </div>
              <div className="text-xs text-white/60">{stage.name}</div>
              <div
                className="w-8 h-0.5 rounded-full mx-auto mt-2"
                style={{ background: stage.color }}
              />
            </motion.div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 flex-1 min-w-48">
            <Search className="w-4 h-4 text-white/40" />
            <input
              placeholder="Search contacts..."
              className="bg-transparent text-sm text-white placeholder-white/30 outline-none flex-1"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/70 hover:border-white/20 transition-colors">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="btn-primary text-sm py-2.5">
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>

        {/* Leads table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card overflow-hidden"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/8">
                {["Contact", "Company", "Stage", "AI Score", "Deal Value", "Tags", ""].map((h) => (
                  <th key={h} className="text-left px-5 py-4 text-xs font-semibold text-white/40 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {leads.map((lead, i) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="hover:bg-white/3 transition-colors group cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: `${lead.color}20`, color: lead.color, border: `1px solid ${lead.color}30` }}
                      >
                        {lead.avatar}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{lead.name}</div>
                        <div className="text-xs text-white/40">{lead.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/60">{lead.company}</td>
                  <td className="px-5 py-4">
                    <span
                      className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        background: `${stageColor[lead.stage] || "#888"}15`,
                        color: stageColor[lead.stage] || "#888",
                        border: `1px solid ${stageColor[lead.stage] || "#888"}30`,
                      }}
                    >
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-5 py-4 w-32">
                    <ScoreBar score={lead.score} color={lead.color} />
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-white">{lead.value}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {lead.tags.map((tag) => (
                        <span key={tag} className="tag-green text-[10px] py-0">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10">
                      <MoreHorizontal className="w-4 h-4 text-white/60" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </div>
  );
}
