"use client";

import { Bell, Search, Plus, ChevronDown, Zap } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-white/8 bg-[#0A0A0F]/80 backdrop-blur-sm sticky top-0 z-20">
      {/* Title */}
      <div>
        <h1 className="text-lg font-bold">{title}</h1>
        {subtitle && <p className="text-xs text-white/40">{subtitle}</p>}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 w-56 hover:border-white/20 transition-colors">
          <Search className="w-3.5 h-3.5 text-white/40" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm text-white placeholder-white/30 outline-none flex-1"
          />
          <kbd className="text-[10px] text-white/30 px-1.5 py-0.5 rounded bg-white/5 font-mono">⌘K</kbd>
        </div>

        {/* New button */}
        <button className="btn-primary text-xs py-2 px-3.5 hidden sm:flex">
          <Plus className="w-3.5 h-3.5" />
          New
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-white/20 transition-colors">
          <Bell className="w-4 h-4 text-white/60" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#00FF87]" />
        </button>

        {/* User */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00FF87]/30 to-[#00D4FF]/30 flex items-center justify-center text-xs font-bold">
            A
          </div>
          <span className="text-sm font-medium hidden sm:block">Alex</span>
          <ChevronDown className="w-3 h-3 text-white/50" />
        </button>
      </div>
    </header>
  );
}
