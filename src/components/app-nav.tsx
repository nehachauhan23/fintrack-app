"use client";

import { ArrowLeftRight, BarChart3, Landmark, LayoutDashboard, PiggyBank, Repeat, Settings, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function NavLinks({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn(orientation === "vertical" ? "flex flex-col gap-0.5" : "flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]")}>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-[5px] px-3 py-2 text-sm font-medium transition",
              active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-paper hover:text-ink",
            )}
          >
            <Icon size={17} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
