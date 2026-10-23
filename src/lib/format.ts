const LOCALE_BY_CURRENCY: Record<string, string> = { INR: "en-IN", EUR: "de-DE", GBP: "en-GB", JPY: "ja-JP", AUD: "en-AU", CAD: "en-CA", SGD: "en-SG", AED: "en-AE" };

export function formatMoney(amount: number, currency = "USD", opts: { compact?: boolean; signed?: boolean; hideCents?: boolean } = {}): string {
  const locale = LOCALE_BY_CURRENCY[currency] ?? "en-US";
  const zeroDecimals = currency === "JPY";
  const fmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    minimumFractionDigits: opts.compact || opts.hideCents || zeroDecimals ? 0 : 2,
    maximumFractionDigits: opts.compact ? 1 : opts.hideCents || zeroDecimals ? 0 : 2,
    signDisplay: opts.signed ? "exceptZero" : "auto",
  });
  return fmt.format(amount);
}

export function formatDate(value: Date | string, style: "short" | "long" | "month" = "short"): string {
  const d = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  const opts: Intl.DateTimeFormatOptions =
    style === "month"
      ? { month: "long", year: "numeric" }
      : style === "long"
        ? { weekday: "short", day: "numeric", month: "short", year: "numeric" }
        : { day: "numeric", month: "short" };
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(d);
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
