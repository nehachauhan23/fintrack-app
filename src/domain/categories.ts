export type CategoryKind = "INCOME" | "EXPENSE" | "TRANSFER";

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  color: string;
}

export const OVERALL_BUDGET = "all";
export const TRANSFER_CATEGORY = "transfer";

// Ids are kept identical to FinTrack v2 so existing rows stay valid.
export const CATEGORIES: readonly Category[] = [
  { id: "salary", name: "Salary", kind: "INCOME", color: "#17784A" },
  { id: "freelance", name: "Freelance", kind: "INCOME", color: "#0A6B66" },
  { id: "investments", name: "Investments", kind: "INCOME", color: "#3F5EA8" },
  { id: "business", name: "Business", kind: "INCOME", color: "#7A5BA8" },
  { id: "rental", name: "Rental", kind: "INCOME", color: "#B7791F" },
  { id: "other-income", name: "Other income", kind: "INCOME", color: "#6B7780" },
  { id: "housing", name: "Housing", kind: "EXPENSE", color: "#B4411B" },
  { id: "transportation", name: "Transport", kind: "EXPENSE", color: "#D9822B" },
  { id: "groceries", name: "Groceries", kind: "EXPENSE", color: "#6E9A2F" },
  { id: "utilities", name: "Utilities", kind: "EXPENSE", color: "#2A8FA3" },
  { id: "entertainment", name: "Entertainment", kind: "EXPENSE", color: "#7A5BA8" },
  { id: "food", name: "Food & dining", kind: "EXPENSE", color: "#C2465F" },
  { id: "shopping", name: "Shopping", kind: "EXPENSE", color: "#B5528F" },
  { id: "healthcare", name: "Healthcare", kind: "EXPENSE", color: "#1F8F85" },
  { id: "education", name: "Education", kind: "EXPENSE", color: "#4A5FB0" },
  { id: "personal", name: "Personal care", kind: "EXPENSE", color: "#A24FB0" },
  { id: "travel", name: "Travel", kind: "EXPENSE", color: "#2F86C0" },
  { id: "insurance", name: "Insurance", kind: "EXPENSE", color: "#5E6C78" },
  { id: "gifts", name: "Gifts & donations", kind: "EXPENSE", color: "#D1688F" },
  { id: "bills", name: "Bills & fees", kind: "EXPENSE", color: "#C95A6B" },
  { id: "other-expense", name: "Other expenses", kind: "EXPENSE", color: "#8C98A3" },
  { id: TRANSFER_CATEGORY, name: "Transfer", kind: "TRANSFER", color: "#9AA5AE" },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.kind === "EXPENSE");
export const INCOME_CATEGORIES = CATEGORIES.filter((c) => c.kind === "INCOME");

export function getCategory(id: string): Category | undefined {
  return BY_ID.get(id);
}

export function categoryName(id: string): string {
  if (id === OVERALL_BUDGET) return "Overall";
  return BY_ID.get(id)?.name ?? id;
}

export function categoryColor(id: string): string {
  return BY_ID.get(id)?.color ?? "#8C98A3";
}

export function isCategoryFor(id: string, type: "INCOME" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT"): boolean {
  const c = BY_ID.get(id);
  if (!c) return false;
  if (type === "INCOME") return c.kind === "INCOME";
  if (type === "EXPENSE") return c.kind === "EXPENSE";
  return c.kind === "TRANSFER";
}

export function categoriesFor(type: "INCOME" | "EXPENSE"): readonly Category[] {
  return type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}
