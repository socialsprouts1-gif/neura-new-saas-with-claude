"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Users,
  Target,
  DollarSign,
  Bot,
  Clock,
  Eye,
  MousePointer,
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
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Header from "@/components/dashboard/Header";

const revenueData = [
  { month: "Jan", revenue: 18000, leads: 420, conversion: 32 },
  { month: "Feb", revenue: 22000, leads: 510, conversion: 35 },
  { month: "Mar", revenue: 28000, leads: 580, conversion: 38 },
  { month: "Apr", revenue: 31000, leads: 640, conversion: 40 },
  { month: "May", revenue: 26000, leads: 520, conversion: 36 },
  { month: "Jun", revenue: 38000, leads: 720, conversion: 45 },
  { month: "Jul", revenue: 42000, leads: 800, conversion: 48 },
];

const channelData = [
  { name: "Inbound", value: 42 },
  { name: "Campaigns", value: 31 },
  { name: "Referral", value: 15 },
  { name: "Organic", value: 12 },
];

const COLORS = ["#00FF87", "#00D4FF", "#A855F7", "#F59E0B"];

const responseTimeData = [
  { hour: "00h", time: 0.4 },
  { hour: "04h", time: 0.3 },
  { hour: "08h", time: 1.2 },
  { hour: "12h", time: 2.1 },
  { hour: "16h", time: 1.8 },
  { hour: "20h", time: 0.9 },
];

const kpis = [
  { label: "Total Revenue", value: "$204K", change: "+31.4%", up: true, icon: DollarSign, color: "#00FF87" },
  { label: "Leads Generated", value: "4,190", change: "+24.8%", up: true, icon: Users, color: "#00D4FF" },
  { label: "Conversion Rate", value: "38.9%", change: "+5.2%", up: true, icon: Target, color: "#A855F7" },
  { label: "Avg Response Time", value: "0.8s", change: "-65%", up: true, icon: Clock, color: "#F59E0B" },
  { label: "Chats Automated", value: "94.2%", change: "+2.1%", up: true, icon: Bot, color: "#EC4899" },
  { label: "Campaign Open Rate", value: "74.2%", change: "+8.3%", up: true, icon: Eye, color: "#00FF87" },
];

export default function AnalyticsPage() {
  return (
    <div className="bg-[#050508] min-h-full">
      <Header title="Analytics" subtitle="Real-time performance insights and revenue tracking" />

      <div className="p-6 space-y-6">
        {/* Date range selector */}
        <div className="flex items-center gap-2">
          {["Today", "7 Days", "30 Days", "3 Months", "This Year"].map((r) => (
            <button
              key={r}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                r === "30 Days"
                  ? "bg-[#00FF87]/10 text-[#00FF87] border border-[#00FF87]/20"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                <span
                  className={`text-xs font-semibold flex items-center gap-0.5 ${kpi.up ? "text-[#00FF87]" : "text-red-400"}`}
                >
                  {kpi.up ? <ArrowUpRight className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {kpi.change}
                </span>
              </div>
              <div className="text-xl font-black" style={{ color: kpi.color }}>{kpi.value}</div>
              <div className="text-[10px] text-white/50 mt-0.5">{kpi.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Revenue chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold">Revenue & Conversions</h3>
              <p className="text-xs text-white/50">Monthly performance overview</p>
            </div>
            <div className="flex gap-3 text-xs text-white/50">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#00FF87]" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#00D4FF]" />Leads</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00FF87" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00FF87" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
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
              <Area type="monotone" dataKey="revenue" stroke="#00FF87" strokeWidth={2} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="leads" stroke="#00D4FF" strokeWidth={2} fill="url(#leadGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Bottom charts */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Channel breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-5"
          >
            <h3 className="font-semibold mb-1">Lead Sources</h3>
            <p className="text-xs text-white/50 mb-5">Where leads come from</p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={channelData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {channelData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(14,14,28,0.95)",
                    border: "1px solid rgba(0,255,135,0.2)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {channelData.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                    <span className="text-white/60">{c.name}</span>
                  </div>
                  <span className="font-semibold">{c.value}%</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Response time */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="glass-card p-5"
          >
            <h3 className="font-semibold mb-1">Avg Response Time</h3>
            <p className="text-xs text-white/50 mb-5">Seconds · by hour of day</p>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={responseTimeData} barSize={20}>
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    background: "rgba(14,14,28,0.95)",
                    border: "1px solid rgba(0,255,135,0.2)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="time" fill="#00D4FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Conversion trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-card p-5"
          >
            <h3 className="font-semibold mb-1">Conversion Rate Trend</h3>
            <p className="text-xs text-white/50 mb-5">Monthly conversion %</p>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[25, 55]} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(14,14,28,0.95)",
                    border: "1px solid rgba(0,255,135,0.2)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Line type="monotone" dataKey="conversion" stroke="#A855F7" strokeWidth={2.5} dot={{ fill: "#A855F7", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
