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
  KanbanSquare,
  ListChecks,
  CalendarDays,
  Receipt,
  ChevronRight,
} from "lucide-react";

// Ordered to match the product's own navigation, not an idea of how it
// should be grouped. Nesting is one level deep: a parent with children
// expands, and nothing hides more than one click away.

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  children?: Array<{ icon: typeof LayoutDashboard; label: string; href: string }>;
}

const SECTIONS: Array<{ label: string; collapsible?: boolean; items: NavItem[] }> = [
  {
    label: "Platform",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/overview" },
      { icon: MessageCircle, label: "Inbox", href: "/inbox" },
      {
        icon: Users,
        label: "Leads",
        href: "/leads/board",
        children: [
          { icon: KanbanSquare, label: "Board", href: "/leads/board" },
          { icon: ListChecks, label: "Lead Status", href: "/leads/status" },
        ],
      },
      { icon: Bell, label: "Reminders", href: "/reminders" },
      { icon: CalendarDays, label: "Meetings", href: "/meetings" },
      { icon: LifeBuoy, label: "My support", href: "/support" },
    ],
  },
  {
    label: "Manage",
    collapsible: true,
    items: [
      { icon: FileText, label: "WhatsApp templates", href: "/templates" },
      { icon: UsersRound, label: "Groups", href: "/groups" },
      { icon: Users, label: "Contacts", href: "/contacts" },
      { icon: Receipt, label: "Transactions", href: "/transactions" },
      { icon: Megaphone, label: "Campaigns", href: "/campaigns" },
      { icon: MessageSquareText, label: "Canned messages", href: "/canned-messages" },
      { icon: Tag, label: "Tags", href: "/tags" },
      { icon: Columns3, label: "Columns", href: "/columns" },
      { icon: BellOff, label: "Opts management", href: "/opts" },
      { icon: GitBranch, label: "Automations", href: "/automations" },
    ],
  },
  {
    label: "Business",
    items: [
      { icon: Plug, label: "Integrations", href: "/integrations" },
      { icon: ShoppingBag, label: "Commerce", href: "/commerce" },
      { icon: ImageIcon, label: "Gallery", href: "/gallery" },
      { icon: HelpCircle, label: "FAQ Bot", href: "/faq-bot" },
      { icon: Bot, label: "Chatbot", href: "/chatbot" },
      { icon: Sparkles, label: "AI Assistant", href: "/ai-assistant" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: Building2, label: "Organizations", href: "/organizations" },
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
    <aside className="flex flex-col w-60 bg-[var(--surface-1)] border-r border-white/8 h-screen sticky top-0 flex-shrink-0">
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/8 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center shadow-[0_0_16px_rgba(0,255,135,0.4)] flex-shrink-0">
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
                  {section.items.map((item) => (
                    <NavEntry key={item.href} item={item} pathname={pathname} />
                  ))}
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

/**
 * One nav row. A parent with children stays open while you are anywhere
 * inside it, so the child you came from is still on screen when you land.
 */
function NavEntry({ item, pathname }: { item: NavItem; pathname: string }) {
  const inside = item.children?.some((child) => pathname === child.href) ?? false;
  const [open, setOpen] = useState(inside);
  const isActive = pathname === item.href && !item.children;

  if (!item.children) {
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive
            ? "bg-accent/10 text-accent-ink border border-accent/20"
            : "text-white/60 hover:text-white hover:bg-white/5"
        }`}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-accent-ink" : ""}`} />
        {item.label}
        {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open || inside}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
          inside ? "text-accent-ink" : "text-white/60 hover:text-white hover:bg-white/5"
        }`}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${inside ? "text-accent-ink" : ""}`} />
        {item.label}
        <ChevronRight
          className={`ml-auto w-3.5 h-3.5 transition-transform ${
            open || inside ? "rotate-90" : ""
          }`}
        />
      </button>

      {(open || inside) && (
        <div className="ml-3.5 pl-3 border-l border-white/8 space-y-0.5 mt-0.5">
          {item.children.map((child) => {
            const childActive = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                  childActive
                    ? "text-accent-ink bg-accent/8"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
