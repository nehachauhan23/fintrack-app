"use client";

import { FileUp, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Badge, Notice } from "@/components/ui/misc";
import { categoryName } from "@/domain/categories";
import { useRun } from "@/lib/use-run";
import { categorizeRowsAction } from "@/server/actions/ai";
import { importCsvAction, previewCsvAction } from "@/server/actions/finance";
import type { CsvPreview, PreviewRow } from "@/server/services/csv-import";
import type { AccountOption } from "./add-transaction";

const MAX_BYTES = 1_400_000;
type Mapping = { date?: string; description?: string; amount?: string; debit?: string; credit?: string };

export function ImportDialog({ accounts, aiReady }: { accounts: AccountOption[]; aiReady: boolean }) {
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState((accounts.find((a) => a.isDefault) ?? accounts[0])?.id ?? "");
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [dateOrder, setDateOrder] = useState<"dmy" | "mdy">("dmy");
  const [invert, setInvert] = useState(false);
  const [mapping, setMapping] = useState<Mapping>({});
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const prev = useRun();
  const ai = useRun();
  const imp = useRun();

  const reset = () => { setCsv(null); setFileName(""); setPreview(null); setRows([]); setResult(null); setMapping({}); };
  const runPreview = (text: string, m: Mapping = mapping, order = dateOrder, inv = invert) =>
    prev.run(() => previewCsvAction({ csv: text, dateOrder: order, invertSign: inv, mapping: m }), { refresh: false, onOk: (p) => { setPreview(p); setRows(p.rows); setMapping(p.mapping as Mapping); } });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return prev.run(async () => ({ ok: false as const, error: { code: "VALIDATION" as const, message: "That file is over 1.4 MB. Split it by date range and import in parts." } }));
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setResult(null);
    runPreview(text);
  };

  const unresolved = rows.filter((r) => r.via === "default");
  const categorise = () => {
    const unique = [...new Map(unresolved.map((r) => [`${r.type}:${r.description.toLowerCase()}`, r])).values()].slice(0, 200);
    ai.run(() => categorizeRowsAction({ items: unique.map((r) => ({ text: r.description, type: r.type })) }), {
      refresh: false,
      onOk: ({ results }) => {
        const found = new Map(unique.map((r, i) => [`${r.type}:${r.description.toLowerCase()}`, results[i]?.category] as const));
        setRows((all) => all.map((r) => { const c = r.via === "default" ? found.get(`${r.type}:${r.description.toLowerCase()}`) : null; return c ? { ...r, category: c, via: "keyword" as const } : r; }));
      },
    });
  };

  const headers = preview?.headers ?? [];
  const opt = () => <><option value="">Not used</option>{headers.map((h) => <option key={h} value={h}>{h}</option>)}</>;
  const total = rows.reduce((s, r) => s + (r.type === "INCOME" ? Number(r.amount) : -Number(r.amount)), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button variant="secondary"><FileUp size={16} /> Import CSV</Button></DialogTrigger>
      <DialogContent title="Import from your bank" description="Upload a CSV export. You'll preview everything before anything is saved, and re-importing the same file never creates duplicates." wide>
        {result ? (
          <div className="space-y-4"><Notice tone="accent">Imported <strong>{result.inserted}</strong> transaction{result.inserted === 1 ? "" : "s"}{result.skipped > 0 && <>; skipped <strong>{result.skipped}</strong> already imported</>}.</Notice><div className="flex justify-end"><Button onClick={() => setOpen(false)}>Done</Button></div></div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Into account" htmlFor="imp-acc"><Select id="imp-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
              <Field label="Dates look like" htmlFor="imp-order"><Select id="imp-order" value={dateOrder} onChange={(e) => { const v = e.target.value as "dmy" | "mdy"; setDateOrder(v); if (csv) runPreview(csv, mapping, v); }}><option value="dmy">31/12/2026 (day first)</option><option value="mdy">12/31/2026 (month first)</option></Select></Field>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-rule px-4 py-4 transition hover:border-accent hover:bg-accent-soft/40">
              {prev.pending ? <Loader2 className="animate-spin text-accent" size={20} /> : <FileUp className="text-accent" size={20} />}
              <span className="min-w-0 flex-1"><span className="block font-medium">{fileName || "Choose a .csv file"}</span><span className="block text-[13px] text-ink-3">Up to about 2,000 rows per import</span></span>
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" checked={invert} className="accent-[var(--accent)]" onChange={(e) => { setInvert(e.target.checked); if (csv) runPreview(csv, mapping, dateOrder, e.target.checked); }} /> Charges are positive numbers (typical for credit-card exports)</label>

            {preview?.needsMapping && (
              <div className="space-y-3 rounded-md border border-warn/40 bg-warn-soft p-4">
                <p className="text-sm font-medium">We couldn&apos;t tell which columns are which. Pick them:</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date" htmlFor="m-date"><Select id="m-date" value={mapping.date ?? ""} onChange={(e) => setMapping({ ...mapping, date: e.target.value })}>{opt()}</Select></Field>
                  <Field label="Description" htmlFor="m-desc"><Select id="m-desc" value={mapping.description ?? ""} onChange={(e) => setMapping({ ...mapping, description: e.target.value })}>{opt()}</Select></Field>
                  <Field label="Amount (one column, +/−)" htmlFor="m-amt"><Select id="m-amt" value={mapping.amount ?? ""} onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}>{opt()}</Select></Field>
                  <div className="grid grid-cols-2 gap-3"><Field label="Debit" htmlFor="m-deb"><Select id="m-deb" value={mapping.debit ?? ""} onChange={(e) => setMapping({ ...mapping, debit: e.target.value })}>{opt()}</Select></Field><Field label="Credit" htmlFor="m-cred"><Select id="m-cred" value={mapping.credit ?? ""} onChange={(e) => setMapping({ ...mapping, credit: e.target.value })}>{opt()}</Select></Field></div>
                </div>
                <Button size="sm" onClick={() => csv && runPreview(csv, mapping)} disabled={prev.pending}>Preview with these columns</Button>
              </div>
            )}

            {preview && !preview.needsMapping && (
              <div className="space-y-3">
                <p className="text-sm text-ink-2"><strong className="text-ink">{rows.length}</strong> rows ready · net <Money value={total} signed tone="auto" />{preview.errorCount > 0 && <> · <span className="text-warn">{preview.errorCount} unreadable row{preview.errorCount === 1 ? "" : "s"} will be skipped</span></>}{preview.truncated && <> · <span className="text-warn">only the first {rows.length} of {preview.totalRows} rows</span></>}</p>
                {preview.errors.length > 0 && <details className="text-[13px] text-ink-3"><summary className="cursor-pointer">Why were rows skipped?</summary><ul className="mt-1 list-disc pl-5">{preview.errors.slice(0, 6).map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}</ul></details>}
                <div className="max-h-56 overflow-auto border-y border-rule">
                  <table className="w-full text-sm"><tbody>
                    {rows.slice(0, 12).map((r) => (
                      <tr key={r.line} className="border-b border-rule/60 last:border-0"><td className="num whitespace-nowrap py-1.5 pr-3 text-ink-3">{r.date}</td><td className="max-w-48 truncate py-1.5 pr-3">{r.description || "(no description)"}</td><td className="whitespace-nowrap py-1.5 pr-3 text-ink-2">{categoryName(r.category)}</td><td className="py-1.5 text-right"><Money value={r.type === "INCOME" ? Number(r.amount) : -Number(r.amount)} tone="auto" /></td></tr>
                    ))}
                  </tbody></table>
                </div>
                {rows.length > 12 && <p className="text-[13px] text-ink-3">…and {rows.length - 12} more</p>}
                {unresolved.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 rounded-md bg-paper px-3 py-2.5 text-sm">
                    <Badge>{unresolved.length} uncategorised</Badge>
                    {aiReady ? <Button variant="secondary" size="sm" disabled={ai.pending} onClick={categorise}>{ai.pending ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} Categorise with AI</Button> : <span className="text-ink-3">They&apos;ll go in “Other”; you can re-file them later.</span>}
                  </div>
                )}
                <div className="flex justify-end"><Button disabled={imp.pending || rows.length === 0 || !accountId} onClick={() => imp.run(() => importCsvAction({ accountId, rows: rows.map(({ date, type, amount, description, category }) => ({ date, type, amount, description, category })) }), { onOk: setResult })}>{imp.pending && <Loader2 className="animate-spin" size={16} />} Import {rows.length} transaction{rows.length === 1 ? "" : "s"}</Button></div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
