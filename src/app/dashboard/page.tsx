"use client";

import { motion } from "framer-motion";
import {
  MessageCircle,
  Users,
  TrendingUp,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Bot,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  Send,
  Eye,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import Header from "@/components/dashboard/Header";

const messageData = [
  { day: "Mon", sent: 1200, received: 980, automated: 850 },
  { day: "Tue", sent: 1890, received: 1400, automated: 1200 },
  { day: "Wed", sent: 2200, received: 1800, automated: 1600 },
  { day: "Thu", sent: 1700, received: 1300, automated: 1100 },
  { day: "Fri", sent: 2800, received: 2200, automated: 2000 },
  { day: "Sat", sent: 3200, received: 2500, automated: 2400 },
  { day: "Sun", sent: 2100, received: 1600, automated: 1500 },
];

const conversionData = [
  { name: "Qualified", value: 40 },
  { name: "Engaged", value: 30 },
  { name: "Converted", value: 20 },
  { name: "Lost", value: 10 },
];

const COLORS = ["#00FF87", "#00D4FF", "#A855F7", "#F87171"];

const campaignData = [
  { name: "Welcome", rate: 92 },
  { name: "Follow-up", rate: 78 },
  { name: "Promo", rate: 65 },
  { name: "Recovery", rate: 48 },
  { name: "Reminder", rate: 88 },
];

const recentChats = [
  { name: "Sarah Mitchell", msg: "Hi! I want to know about the pricing plans", time: "2m ago", status: "bot", avatar: "S", tag: "Lead" },
  { name: "James Rodriguez", msg: "My order #4521 hasn't arrived yet", time: "8m ago", status: "human", avatar: "J", tag: "Support" },
  { name: "Priya Patel", msg: "Can I schedule a demo for tomorrow?", time: "15m ago", status: "bot", avatar: "P", tag: "Demo" },
  { name: "Chris Wang", msg: "Thank you! Just completed the payment", time: "32m ago", status: "resolved", avatar: "C", tag: "Sale" },
  { name: "Emma Thompson", msg: "How do I connect my Shopify store?", time: "1h ago", status: "bot", avatar: "E", tag: "Onboard" },
];

const stats = [
  {
    label: "Messages Today",
    value: "12,847",
    change: "+24.5%",
    up: true,
    icon: MessageCircle,
    color: "#00FF87",
    bgColor: "rgba(0,255,135,0.1)",
    sub: "vs yesterday",
  },
  {
    label: "Active Leads",
    value: "3,421",
    change: "+18.2%",
    up: true,
    icon: Users,
    color: "#00D4FF",
    bgColor: "rgba(0,212,255,0.1)",
    sub: "in pipeline",
  },
  {
    label: "Revenue (MTD)",
    value: "$48,290",
    change: "+31.4%",
    up: true,
    icon: TrendingUp,
    color: "#A855F7",
    bgColor: "rgba(168,85,247,0.1)",
    sub: "month to date",
  },
  {
    label: "Bot Automation",
    value: "94.2%",
    change: "-1.3%",
    up: false,
    icon: Bot,
    color: "#F59E0B",
    bgColor: "rgba(245,158,11,0.1)",
    sub: "of total chats",
  },
];

export default function DashboardPage() {
  return (
    <div className="bg-[#050508] min-h-full">
      <Header
        title="Dashboard"
        subtitle="Thursday, 22 May 2026 · Live"
      />

      <div className="p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card p-5 hover:border-white/20 transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: stat.bgColor, border: `1px solid ${stat.color}25` }}
                >
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <span
                  className={`flex items-center gap-1 text-xs font-semibold ${stat.up ? "text-[#00FF87]" : "text-red-400"}`}
                >
                  {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.change}
                </span>
              </div>
              <div className="text-2xl font-black mb-0.5">{stat.value}</div>
              <div className="text-xs text-white/50">{stat.label} · {stat.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Message volume chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-5 lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold">Message Volume</h3>
                <p className="text-xs text-white/50 mt-0.5">Last 7 days</p>
              </div>
              <div className="flex gap-3 text-xs text-white/50">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00FF87]" />Sent
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00D4FF]" />Received
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#A855F7]" />Automated
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={messageData}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF87" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00FF87" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAuto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A855F7" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#A855F7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    background: "rgba(14,14,28,0.95)",
                    border: "1px solid rgba(0,255,135,0.2)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="sent" stroke="#00FF87" strokeWidth={2} fill="url(#colorSent)" />
                <Area type="monotone" dataKey="received" stroke="#00D4FF" strokeWidth={2} fill="url(#colorReceived)" />
                <Area type="monotone" dataKey="automated" stroke="#A855F7" strokeWidth={2} fill="url(#colorAuto)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Conversion funnel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-5"
          >
            <div className="mb-5">
              <h3 className="font-semibold">Lead Funnel</h3>
              <p className="text-xs text-white/50 mt-0.5">Conversion stages</p>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={conversionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {conversionData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index]} />
                  ))}
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
            <div className="grid grid-cols-2 gap-2 mt-2">
              {conversionData.map((item, i) => (
                <div key={item.name} className="flex items-center gap-1.5 text-xs text-white/60">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                  <span>{item.name}: {item.value}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom row */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Recent chats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold">Live Conversations</h3>
                <p className="text-xs text-white/50">5 active conversations</p>
              </div>
              <button className="text-xs text-[#00FF87] hover:text-[#00CC6A] transition-colors">
                View All
              </button>
            </div>
            <div className="space-y-3">
              {recentChats.map((chat) => (
                <div
                  key={chat.name}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00FF87]/20 to-[#00D4FF]/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {chat.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{chat.name}</span>
                      <span className="text-xs text-white/40">{chat.time}</span>
                    </div>
                    <div className="text-xs text-white/50 truncate">{chat.msg}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        chat.status === "bot"
                          ? "bg-[#00FF87]/10 text-[#00FF87]"
                          : chat.status === "human"
                          ? "bg-[#00D4FF]/10 text-[#00D4FF]"
                          : "bg-white/5 text-white/40"
                      }`}
                    >
                      {chat.status === "bot" ? "🤖 AI" : chat.status === "human" ? "👤 Live" : "✓ Done"}
                    </span>
                    <span className="tag-green text-[10px] py-0">{chat.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Campaign performance */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold">Campaign Performance</h3>
                <p className="text-xs text-white/50">Open rate by type</p>
              </div>
              <button className="text-xs text-[#00FF87]">View All</button>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={campaignData} barSize={20}>
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(14,14,28,0.95)",
                    border: "1px solid rgba(0,255,135,0.2)",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="rate" fill="#00FF87" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/8">
              {[
                { label: "Active Campaigns", value: "12", icon: Send },
                { label: "Total Sent", value: "248K", icon: CheckCircle },
                { label: "Avg Open Rate", value: "74.2%", icon: Eye },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-lg font-bold gradient-text-green">{s.value}</div>
                  <div className="text-[10px] text-white/50">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* AI Insights bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-4 border-[#00FF87]/15 bg-[#00FF87]/3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00FF87]/20 border border-[#00FF87]/30 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-[#00FF87]" />
            </div>
            <div className="flex-1">
              <span className="text-xs font-semibold text-[#00FF87] mr-2">AI Insight:</span>
              <span className="text-sm text-white/70">
                Your <strong className="text-white">Friday campaigns</strong> perform 42% better than weekdays.
                Consider scheduling your next broadcast for Friday 10 AM for maximum engagement.
              </span>
            </div>
            <button className="text-xs text-[#00FF87] whitespace-nowrap hover:underline">
              Apply Suggestion
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
