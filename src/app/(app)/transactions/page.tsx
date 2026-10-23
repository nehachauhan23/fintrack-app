import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, SearchX } from "lucide-react";
import { Money } from "@/components/money";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { FiltersBar } from "@/features/transactions/filters-bar";
import { ImportDialog } from "@/features/transactions/import-dialog";
import { TidyButton } from "@/features/transactions/tidy-button";
import { TransactionsTable } from "@/features/transactions/transactions-table";
import { TransferDialog } from "@/features/transactions/transfer-dialog";
import { filtersFromSearchParams } from "@/lib/filters";
import { aiConfigured } from "@/server/ai/openrouter";
import { requireUser } from "@/server/auth/dal";
import { listAccounts } from "@/server/services/accounts";
import { listTransactions } from "@/server/services/transactions";

export const metadata: Metadata = { title: "Transactions" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const [accounts, data] = await Promise.all([listAccounts(user.id), listTransactions(user.id, filters, page, 25)]);
  const aiReady = user.aiEnabled && aiConfigured();
  const filtered = Object.keys(filters).length > 0;

  const qs = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)]));
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  };

  return (
    <>
      <PageHeader title="Transactions" description="Search, filter, fix and import every entry." action={<>{aiReady && <TidyButton />}<ImportDialog accounts={accounts} aiReady={aiReady} /><TransferDialog accounts={accounts} /><LinkButton variant="secondary" href={`/api/export/transactions?${qs()}`}><Download size={16} /> Export CSV</LinkButton></>} />
      <FiltersBar accounts={accounts} />

      {data.total === 0 ? (
        <EmptyState icon={<SearchX size={26} />} title={filtered ? "Nothing matches those filters" : "No transactions yet"} body={filtered ? "Try a wider date range or clear a filter." : "Add one with the button above, or import a CSV export from your bank."} />
      ) : (
        <>
          <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
            <span><strong className="text-ink">{data.total.toLocaleString()}</strong> result{data.total === 1 ? "" : "s"}</span>
            <span>Income <Money value={data.income} className="font-medium text-gain" /></span>
            <span>Spending <Money value={data.expense} className="font-medium text-loss" /></span>
          </p>
          <TransactionsTable items={data.items} accounts={accounts} />
          {data.pageCount > 1 && (
            <nav aria-label="Pagination" className="mt-5 flex items-center justify-between text-sm">
              {data.page > 1 ? <Link href={`/transactions?${qs({ page: String(data.page - 1) })}`} className="flex items-center gap-1 font-medium text-accent hover:underline"><ChevronLeft size={15} /> Newer</Link> : <span />}
              <span className="text-ink-3">Page {data.page} of {data.pageCount}</span>
              {data.page < data.pageCount ? <Link href={`/transactions?${qs({ page: String(data.page + 1) })}`} className="flex items-center gap-1 font-medium text-accent hover:underline">Older <ChevronRight size={15} /></Link> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
