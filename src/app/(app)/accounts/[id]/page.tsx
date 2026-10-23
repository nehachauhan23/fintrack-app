import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BalanceChart } from "@/components/charts/balance-chart";
import { Money } from "@/components/money";
import { Badge, PageHeader, Section } from "@/components/ui/misc";
import { AccountControls, ReconcilePanel } from "@/features/accounts/account-controls";
import { EditAccountDialog } from "@/features/accounts/account-dialogs";
import { categoryName } from "@/domain/categories";
import { AppError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { accountTypeLabel } from "@/lib/labels";
import { requireUser } from "@/server/auth/dal";
import { getAccountView } from "@/server/services/accounts";
import { accountLedger, balanceHistory } from "@/server/services/analytics";

export const metadata: Metadata = { title: "Account" };

export default async function AccountDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const account = await getAccountView(user.id, id).catch((err) => {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  });
  const [history, ledger] = await Promise.all([balanceHistory(user.id, id, 60), accountLedger(user.id, id, 60)]);

  return (
    <>
      <Link href="/accounts" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink"><ChevronLeft size={15} /> Accounts</Link>
      <PageHeader title={account.name} description={accountTypeLabel(account.type)} action={<EditAccountDialog id={account.id} name={account.name} type={account.type} />} />

      <div className="rise flex flex-wrap items-end gap-x-6 gap-y-2">
        <div><p className="eyebrow">Balance</p><Money value={account.balance} tone="auto" className="display text-[3.6rem] leading-none" /></div>
        <div className="flex gap-2 pb-2">{account.isDefault && <Badge tone="accent">Default</Badge>}{account.archived && <Badge tone="warn">Archived</Badge>}</div>
      </div>

      <div className="mt-6"><AccountControls id={account.id} isDefault={account.isDefault} archived={account.archived} hasTransactions={ledger.length > 0} /></div>

      <Section title="Last 60 days" className="mt-10"><BalanceChart data={history} /></Section>

      <Section title="Ledger" eyebrow="Latest entries" className="mt-10">
        {ledger.length === 0 ? (
          <p className="text-ink-2">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead><tr className="eyebrow border-b border-rule text-left"><th className="py-2 pr-3 font-semibold">Date</th><th className="py-2 pr-3 font-semibold">Entry</th><th className="py-2 pr-3 text-right font-semibold">Amount</th><th className="py-2 text-right font-semibold">Balance</th></tr></thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id} className="border-b border-rule/70">
                    <td className="num whitespace-nowrap py-2.5 pr-3 text-ink-3">{formatDate(r.date)}</td>
                    <td className="py-2.5 pr-3"><span className="font-medium">{r.description}</span> <span className="text-ink-3">· {categoryName(r.category)}</span></td>
                    <td className="py-2.5 pr-3 text-right"><Money value={r.signed} signed tone={r.type.startsWith("TRANSFER") ? "none" : "auto"} /></td>
                    <td className="py-2.5 text-right font-medium"><Money value={r.balance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm"><Link href={`/transactions?accountId=${account.id}`} className="font-medium text-accent hover:underline">Search and filter everything in this account</Link></p>
      </Section>

      <Section title="Integrity" className="mt-10"><ReconcilePanel id={account.id} /></Section>
    </>
  );
}
