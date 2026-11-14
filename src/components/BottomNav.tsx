"use client";

import { Home, Send, Download, Clock } from "lucide-react";

export type BottomNavItem = "home" | "send" | "receive" | "history";

export interface BottomNavProps {
  activeItem?: BottomNavItem;
  onHome: () => void;
  onSend: () => void;
  onReceive: () => void;
  onHistory: () => void;
}

/**
 * Mobile-first bottom navigation bar visible below the lg breakpoint.
 */
export function BottomNav({
  activeItem,
  onHome,
  onSend,
  onReceive,
  onHistory,
}: BottomNavProps) {
  const navItems = [
    {
      id: "home" as const,
      label: "Home",
      icon: Home,
      onClick: onHome,
    },
    {
      id: "send" as const,
      label: "Send",
      icon: Send,
      onClick: onSend,
    },
    {
      id: "receive" as const,
      label: "Receive",
      icon: Download,
      onClick: onReceive,
    },
    {
      id: "history" as const,
      label: "History",
      icon: Clock,
      onClick: onHistory,
    },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="lg:hidden fixed bottom-3 left-3 right-3 max-w-md mx-auto z-40 glass-card rounded-3xl p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] shadow-lg flex items-center justify-around"
    >
      {navItems.map((item) => {
        const isActive = activeItem === item.id;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
              isActive
                ? "text-[var(--accent)] font-bold bg-[var(--accent-soft)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)] font-medium"
            }`}
          >
            <Icon className="h-5 w-5 mb-0.5" />
            <span className="text-[11px] leading-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
