"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Zap,
  LayoutDashboard,
  MessageCircle,
  Bell,
  LifeBuoy,
  Users,
  Megaphone,
  GitBranch,
  Bot,
  Sparkles,
  HelpCircle,
  Plug,
  ShoppingBag,
  Image as ImageIcon,
  Building2,
  Code2,
  CreditCard,
  Settings,
  Shield,
  ChevronDown,
  UsersRound,
  Tag,
  Columns3,
  FileText,
  MessageSquareText,
  BellOff,
} from "lucide-react";

// Grouped to match how the product is actually used: what you do all day,
// what answers on your behalf, what you sell, and what you configure once.
const SECTIONS = [
  {
    label: "Platform",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/overview" },
      { icon: MessageCircle, label: "Inbox", href: "/inbox" },
      { icon: Bell, label: "Reminders", href: "/reminders" },
      { icon: LifeBuoy, label: "My support", href: "/support" },
    ],
  },
  {
    label: "Manage",
    collapsible: true,
    items: [
      { icon: Users, label: "Contacts", href: "/contacts" },
      { icon: UsersRound, label: "Groups", href: "/groups" },
      { icon: Tag, label: "Tags", href: "/tags" },
      { icon: Columns3, label: "Columns", href: "/columns" },
      { icon: FileText, label: "WhatsApp templates", href: "/templates" },
      { icon: MessageSquareText, label: "Canned messages", href: "/canned-messages" },
      { icon: Megaphone, label: "Campaigns", href: "/campaigns" },
      { icon: GitBranch, label: "Automations", href: "/automations" },
      { icon: BellOff, label: "Opts management", href: "/opts" },
    ],
  },
  {
    label: "AI",
    items: [
      { icon: Bot, label: "Chatbot", href: "/chatbot" },
      { icon: Sparkles, label: "AI Assistant", href: "/ai-assistant" },
      { icon: HelpCircle, label: "FAQ Bot", href: "/faq-bot" },
    ],
  },
  {
    label: "Business",
    items: [
      { icon: Plug, label: "Integrations", href: "/integrations" },
      { icon: ShoppingBag, label: "Commerce", href: "/commerce" },
      { icon: ImageIcon, label: "Gallery", href: "/gallery" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: Building2, label: "Organization", href: "/organizations" },
      { icon: Code2, label: "API Endpoints", href: "/api-endpoints" },
      { icon: CreditCard, label: "Billing", href: "/billing" },
      { icon: Settings, label: "Settings", href: "/settings" },
    ],
  },
];

export default function Sidebar({ isPlatformAdmin = false }: { isPlatformAdmin?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside className="flex flex-col w-60 bg-[#0A0A0F] border-r border-white/8 h-screen sticky top-0 flex-shrink-0">
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/8 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00FF87] to-[#00D4FF] flex items-center justify-center shadow-[0_0_16px_rgba(0,255,135,0.4)] flex-shrink-0">
          <Zap className="w-4 h-4 text-[#050508]" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm leading-tight whitespace-nowrap">
            Neura <span className="gradient-text-green">Chat</span>
          </div>
          <div className="text-[9px] uppercase tracking-widest text-white/30">Business inbox</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {SECTIONS.map((section) => {
          const isCollapsed = section.collapsible && collapsed[section.label];
          return (
            <div key={section.label}>
              {section.collapsible ? (
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [section.label]: !c[section.label] }))
                  }
                  className="w-full flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-white/30 px-3 mb-2 hover:text-white/50 transition-colors"
                  aria-expanded={!isCollapsed}
                >
                  {section.label}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  />
                </button>
              ) : (
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-3 mb-2">
                  {section.label}
                </div>
              )}

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-[#00FF87]/10 text-[#00FF87] border border-[#00FF87]/20"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <item.icon
                          className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#00FF87]" : ""}`}
                        />
                        {item.label}
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00FF87]" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Only rendered for platform staff. Hiding it is a convenience, not the
          control — /admin re-checks server-side and RLS enforces the rest. */}
      {isPlatformAdmin && (
        <div className="border-t border-white/8 p-3 flex-shrink-0">
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#A855F7] hover:bg-[#A855F7]/10 transition-all"
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            Admin panel
          </Link>
        </div>
      )}
    </aside>
  );
}
