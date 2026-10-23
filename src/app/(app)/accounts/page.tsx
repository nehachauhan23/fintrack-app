import type { Metadata } from "next";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { Money } from "@/components/money";
import { Badge, EmptyState, PageHeader, Section, Stat } from "@/components/ui/misc";
import { CreateAccountDialog } from "@/features/accounts/account-dialogs";
import { TransferDialog } from "@/features/transactions/transfer-dialog";
import { accountTypeLabel } from "@/lib/labels";
import { requireUser } from "@/server/auth/dal";
import { listAccounts } from "@/server/services/accounts";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const user = await requireUser();
  const all = await listAccounts(user.id, { includeArchived: true });
  const active = all.filter((a) => !a.archived);
  const archived = all.filter((a) => a.archived);
  const assets = active.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const debts = active.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <PageHeader title="Accounts" description="Everything that holds money, with balances you can verify." action={<><TransferDialog accounts={active} /><CreateAccountDialog /></>} />

      {active.length === 0 ? (
        <EmptyState icon={<Landmark size={26} />} title="No accounts yet" body="Add the first one and enter what it holds today. You can record the rest as you go." action={<CreateAccountDialog first />} />
      ) : (
        <>
          <div className="rise mb-10 grid max-w-xl grid-cols-2 gap-8">
            <Stat label="Held" value={<Money value={assets} />} />
            <Stat label="Owed" value={<Money value={debts} />} tone={debts < 0 ? "loss" : undefined} />
          </div>
          <Section>
            <ul className="divide-y divide-rule border-b border-rule">
              {active.map((a) => (
                <li key={a.id}>
                  <Link href={`/accounts/${a.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 transition hover:bg-accent-soft/40 sm:px-3">
                    <div className="min-w-0">
                      <p className="display truncate text-2xl leading-tight group-hover:text-accent">{a.name}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-3">{accountTypeLabel(a.type)} {a.isDefault && <Badge tone="accent">Default</Badge>}</p>
                    </div>
                    <Money value={a.balance} tone="auto" className="text-xl font-semibold" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      {archived.length > 0 && (
        <Section title="Archived" className="mt-10">
          <ul className="divide-y divide-rule">
            {archived.map((a) => (
              <li key={a.id}><Link href={`/accounts/${a.id}`} className="flex items-center justify-between py-3 text-ink-2 hover:text-ink"><span>{a.name}</span><Money value={a.balance} /></Link></li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
