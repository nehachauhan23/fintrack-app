import { normalizeMerchant } from "./merchant";

export type Metric = "expense" | "income" | "net" | "count";
export type GroupBy = "none" | "category" | "merchant" | "month" | "account";

export interface QueryRow {
  date: Date;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  merchant: string | null;
  description: string | null;
  accountId: string;
}

export interface Group {
  key: string;
  label: string;
  value: number;
  count: number;
}

export interface Aggregate {
  total: number;
  count: number;
  groups: Group[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function valueOf(row: QueryRow, metric: Metric): number {
  if (metric === "count") return 1;
  if (metric === "net") return row.type === "INCOME" ? row.amount : -row.amount;
  return row.amount;
}

function groupKey(row: QueryRow, by: GroupBy): { key: string; label: string } {
  switch (by) {
    case "category":
      return { key: row.category, label: row.category };
    case "account":
      return { key: row.accountId, label: row.accountId };
    case "month":
      return { key: row.date.toISOString().slice(0, 7), label: row.date.toISOString().slice(0, 7) };
    case "merchant": {
      const raw = (row.merchant || row.description || "").trim();
      const key = normalizeMerchant(raw) || "(no description)";
      return { key, label: raw || "(no description)" };
    }
    case "none":
      return { key: "", label: "" };
  }
}

/** Pure, deterministic aggregation: the database supplies rows, this supplies every number the assistant ever shows. */
export function aggregate(rows: QueryRow[], opts: { metric: Metric; groupBy: GroupBy; limit: number; label?: (by: GroupBy, key: string, fallback: string) => string }): Aggregate {
  let total = 0;
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const v = valueOf(row, opts.metric);
    total += v;
    if (opts.groupBy === "none") continue;
    const { key, label } = groupKey(row, opts.groupBy);
    const g = groups.get(key) ?? { key, label: opts.label ? opts.label(opts.groupBy, key, label) : label, value: 0, count: 0 };
    g.value += v;
    g.count += 1;
    groups.set(key, g);
  }
  let list = [...groups.values()].map((g) => ({ ...g, value: round2(g.value) }));
  list = opts.groupBy === "month" ? list.sort((a, b) => a.key.localeCompare(b.key)).slice(-60) : list.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, opts.limit);
  return { total: round2(total), count: rows.length, groups: list };
}
