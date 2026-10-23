import "server-only";
import Papa from "papaparse";
import { invalid } from "@/lib/errors";
import { detectColumns, mapRows, type ColumnMapping, type DateOrder, type ParsedRow, type RowError } from "@/domain/csv";
import { loadRulesFor, resolveLocally } from "./merchant-rules";

export const MAX_IMPORT_ROWS = 2000;

export interface PreviewRow extends ParsedRow {
  category: string;
  via: "rule" | "keyword" | "default";
}

export interface CsvPreview {
  headers: string[];
  mapping: Partial<ColumnMapping>;
  /** True when the columns could not be identified and the user must choose them. */
  needsMapping: boolean;
  rows: PreviewRow[];
  errors: RowError[];
  errorCount: number;
  totalRows: number;
  truncated: boolean;
}

/**
 * Parses a bank export without writing anything. Columns are auto-detected, rows are validated and given a first-pass
 * category from the user's learned rules and the keyword dictionary; the user reviews it all before importing.
 */
export async function previewCsv(userId: string, csv: string, opts: { dateOrder: DateOrder; invertSign: boolean; mapping?: Partial<ColumnMapping> }): Promise<CsvPreview> {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const headers = (parsed.meta.fields ?? []).filter(Boolean);
  if (headers.length < 2 || parsed.data.length === 0) throw invalid("That file doesn't look like a CSV with a header row and data.");

  const detected = detectColumns(headers);
  const merged = { ...detected, ...Object.fromEntries(Object.entries(opts.mapping ?? {}).filter(([, v]) => v)) } as Partial<ColumnMapping>;
  const valid = (c?: string) => !!c && headers.includes(c);
  const hasAmount = valid(merged.amount) || (valid(merged.debit) && valid(merged.credit)) || valid(merged.debit) || valid(merged.credit);
  const needsMapping = !valid(merged.date) || !valid(merged.description) || !hasAmount;
  const total = parsed.data.length;
  if (needsMapping) return { headers, mapping: merged, needsMapping, rows: [], errors: [], errorCount: 0, totalRows: total, truncated: false };

  const { rows, errors } = mapRows(parsed.data.slice(0, MAX_IMPORT_ROWS), merged as ColumnMapping, { dateOrder: opts.dateOrder, invertSign: opts.invertSign });
  const rules = await loadRulesFor(userId, rows.map((r) => r.description));
  const withCategory: PreviewRow[] = rows.map((r) => {
    const hit = resolveLocally(r.description, r.type, rules);
    return { ...r, category: hit?.category ?? (r.type === "INCOME" ? "other-income" : "other-expense"), via: hit?.via ?? "default" };
  });
  return { headers, mapping: merged, needsMapping, rows: withCategory, errors: errors.slice(0, 20), errorCount: errors.length, totalRows: total, truncated: total > MAX_IMPORT_ROWS };
}
