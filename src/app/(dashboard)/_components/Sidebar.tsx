"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, MessageCircle, Megaphone, Users, GitBranch, Settings } from "lucide-react";

const navItems = [
  { icon: MessageCircle, label: "Inbox", href: "/inbox" },
  { icon: Megaphone, label: "Campaigns", href: "/campaigns" },
  { icon: Users, label: "Contacts", href: "/contacts" },
  { icon: GitBranch, label: "Automations", href: "/automations" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-60 bg-[#0A0A0F] border-r border-white/8 h-screen sticky top-0 flex-shrink-0">
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/8 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00FF87] to-[#00D4FF] flex items-center justify-center shadow-[0_0_16px_rgba(0,255,135,0.4)] flex-shrink-0">
          <Zap className="w-4 h-4 text-[#050508]" />
        </div>
        <span className="font-bold text-base whitespace-nowrap">
          Neura <span className="gradient-text-green">Chat</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[#00FF87]/10 text-[#00FF87] border border-[#00FF87]/20"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#00FF87]" : ""}`} />
              {item.label}
              {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00FF87]" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
