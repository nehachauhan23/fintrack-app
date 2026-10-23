"use client";

import { createContext, useContext, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

const CurrencyContext = createContext("USD");

export function CurrencyProvider({ currency, children }: { currency: string; children: React.ReactNode }) {
  return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useMoney() {
  const currency = useContext(CurrencyContext);
  return useMemo(() => ({ currency, fmt: (n: number, o?: Parameters<typeof formatMoney>[2]) => formatMoney(n, currency, o) }), [currency]);
}

/** A figure with consistent alignment and meaning-bearing colour. */
export function Money({ value, signed, tone, compact, className }: { value: number; signed?: boolean; tone?: "auto" | "none"; compact?: boolean; className?: string }) {
  const { fmt } = useMoney();
  const color = tone === "auto" ? (value > 0 ? "text-gain" : value < 0 ? "text-loss" : "") : "";
  return <span className={cn("num whitespace-nowrap", color, className)}>{fmt(value, { signed, compact })}</span>;
}
