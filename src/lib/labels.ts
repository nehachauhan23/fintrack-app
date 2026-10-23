export const ACCOUNT_TYPES = [
  { value: "CURRENT", label: "Current / checking" },
  { value: "SAVINGS", label: "Savings" },
  { value: "CREDIT_CARD", label: "Credit card" },
  { value: "CASH", label: "Cash" },
  { value: "INVESTMENT", label: "Investment" },
] as const;

export const accountTypeLabel = (t: string) => ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;

export const INTERVAL_LABEL: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", YEARLY: "Yearly" };
