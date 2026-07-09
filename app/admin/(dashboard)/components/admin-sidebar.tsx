"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  Users,
  Receipt,
  TrendingUp,
  Settings,
  LogOut,
  HeartPulse,
  Bug,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/admin", label: "Calendrier", icon: CalendarDays, exact: true },
  { href: "/admin/reservations", label: "Réservations", icon: ClipboardList },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/facturation", label: "Facturation", icon: Receipt },
  { href: "/admin/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/admin/configuration", label: "Configuration", icon: Settings },
  { href: "/admin/diagnostic", label: "Diagnostic", icon: HeartPulse },
];

const DEBUG_ITEM = { href: "/admin/_debug", label: "Debug", icon: Bug };
const IS_DEV = process.env.NODE_ENV !== "production";

export function AdminSidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-border bg-bg-card">
      <div className="border-b border-border px-5 py-5">
        <h1 className="text-lg font-semibold text-primary-dark">Pure Spa</h1>
        <p className="text-xs text-text-muted">Administration</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent-light text-primary-dark"
                  : "text-text-muted hover:bg-accent-light/50 hover:text-text"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
        {IS_DEV && (
          <Link
            href={DEBUG_ITEM.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              isActive(DEBUG_ITEM.href)
                ? "bg-accent-light text-primary-dark"
                : "text-text-muted hover:bg-accent-light/50 hover:text-text"
            }`}
          >
            <DEBUG_ITEM.icon size={18} />
            {DEBUG_ITEM.label}
          </Link>
        )}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="truncate text-xs text-text-muted">{email}</p>
        <button
          onClick={handleSignOut}
          className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-accent-light hover:text-error"
        >
          <LogOut size={14} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
