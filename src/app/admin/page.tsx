"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Zap,
  Users,
  DollarSign,
  Server,
  Shield,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Settings,
  BarChart3,
  MessageCircle,
  Globe,
  ArrowUpRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const mrr = [
  { month: "Jan", mrr: 42000 },
  { month: "Feb", mrr: 51000 },
  { month: "Mar", mrr: 63000 },
  { month: "Apr", mrr: 72000 },
  { month: "May", mrr: 88000 },
  { month: "Jun", mrr: 102000 },
  { month: "Jul", mrr: 124000 },
];

const recentUsers = [
  { name: "Sarah M.", email: "sarah@store.com", plan: "Growth", joined: "2h ago", status: "Active" },
  { name: "David C.", email: "david@agency.com", plan: "Agency", joined: "5h ago", status: "Trial" },
  { name: "Priya G.", email: "priya@health.in", plan: "Starter", joined: "1d ago", status: "Active" },
  { name: "Carlos R.", email: "carlos@rest.mx", plan: "Growth", joined: "2d ago", status: "Active" },
];

const systemHealth = [
  { service: "WhatsApp API Gateway", status: "Operational", uptime: "99.99%" },
  { service: "AI Processing Engine", status: "Operational", uptime: "99.97%" },
  { service: "Message Queue", status: "Operational", uptime: "100%" },
  { service: "Database Cluster", status: "Degraded", uptime: "98.4%" },
  { service: "CDN", status: "Operational", uptime: "99.99%" },
];

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {/* Admin Header */}
      <header className="flex items-center justify-between px-8 h-16 border-b border-white/8 bg-[#0A0A0F]/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00FF87] to-[#00D4FF] flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#050508]" />
          </div>
          <span className="font-bold">WhatsFlow AI</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 font-semibold">
            ADMIN
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs text-white/50 hover:text-white transition-colors">
            ← Back to App
          </Link>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FF87]/20 to-[#00D4FF]/20 flex items-center justify-center text-xs font-bold">
            SA
          </div>
        </div>
      </header>

      <div className="p-8 space-y-6">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Monthly Recurring Revenue", value: "$124K", change: "+21.4%", icon: DollarSign, color: "#00FF87" },
            { label: "Total Active Users", value: "50,240", change: "+8.2%", icon: Users, color: "#00D4FF" },
            { label: "Messages This Month", value: "248M", change: "+34.1%", icon: MessageCircle, color: "#A855F7" },
            { label: "Countries Active", value: "142", change: "+12", icon: Globe, color: "#F59E0B" },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${kpi.color}15`, border: `1px solid ${kpi.color}25` }}
                >
                  <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                </div>
                <span className="text-xs font-semibold text-[#00FF87] flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" />
                  {kpi.change}
                </span>
              </div>
              <div className="text-2xl font-black mb-0.5" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-xs text-white/50">{kpi.label}</div>
            </motion.div>
          ))}
        </div>

        {/* MRR chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold">Monthly Recurring Revenue</h3>
              <p className="text-xs text-white/50">2024 growth trajectory</p>
            </div>
            <div className="text-3xl font-black gradient-text-green">$124K MRR</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mrr}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FF87" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00FF87" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  background: "rgba(14,14,28,0.95)",
                  border: "1px solid rgba(0,255,135,0.2)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
              <Area type="monotone" dataKey="mrr" stroke="#00FF87" strokeWidth={2.5} fill="url(#mrrGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Bottom grid */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Recent users */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold">Recent Signups</h3>
              <button className="text-xs text-[#00FF87]">View All</button>
            </div>
            <div className="space-y-3">
              {recentUsers.map((u) => (
                <div key={u.email} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FF87]/20 to-[#00D4FF]/20 flex items-center justify-center text-xs font-bold">
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{u.name}</div>
                    <div className="text-xs text-white/40">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tag-blue text-[10px]">{u.plan}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        u.status === "Trial"
                          ? "bg-yellow-400/10 text-yellow-400"
                          : "bg-[#00FF87]/10 text-[#00FF87]"
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                  <span className="text-xs text-white/40 flex-shrink-0">{u.joined}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* System health */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold">System Health</h3>
              <span className="flex items-center gap-1.5 text-xs text-[#00FF87]">
                <Activity className="w-3.5 h-3.5" />
                All systems monitored
              </span>
            </div>
            <div className="space-y-3">
              {systemHealth.map((s) => (
                <div key={s.service} className="flex items-center gap-3">
                  {s.status === "Operational" ? (
                    <CheckCircle className="w-4 h-4 text-[#00FF87] flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.service}</div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      s.status === "Operational"
                        ? "bg-[#00FF87]/10 text-[#00FF87]"
                        : "bg-yellow-400/10 text-yellow-400"
                    }`}
                  >
                    {s.status}
                  </span>
                  <span className="text-xs text-white/40 font-mono">{s.uptime}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
