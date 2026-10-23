import { LogOut } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { NavLinks } from "@/components/app-nav";
import { CurrencyProvider } from "@/components/money";
import { Button } from "@/components/ui/button";
import { AddTransaction } from "@/features/transactions/add-transaction";
import { aiConfigured } from "@/server/ai/openrouter";
import { requireUser } from "@/server/auth/dal";
import { signOutAction } from "@/server/actions/auth";
import { listAccounts } from "@/server/services/accounts";
import { initials } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const accounts = await listAccounts(user.id);
  const aiReady = user.aiEnabled && aiConfigured();

  return (
    <CurrencyProvider currency={user.currency}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col justify-between border-r border-rule bg-surface px-4 py-6 lg:flex">
          <div className="space-y-8">
            <div className="px-3"><Wordmark href="/dashboard" /></div>
            <NavLinks orientation="vertical" />
          </div>
          <div className="space-y-3 border-t border-rule pt-4">
            <div className="flex items-center gap-3 px-3">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{initials(user.name)}</span>
              <div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="truncate text-xs text-ink-3">{user.email}</p></div>
            </div>
            <form action={signOutAction}><Button type="submit" variant="ghost" size="sm" className="w-full justify-start px-3"><LogOut size={15} /> Sign out</Button></form>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between px-5 py-3">
              <Wordmark href="/dashboard" />
              <form action={signOutAction}><Button type="submit" variant="ghost" size="sm"><LogOut size={15} /> Sign out</Button></form>
            </div>
            <NavLinks orientation="horizontal" />
          </div>
          <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">
            <div className="mb-6 flex justify-end">
              <AddTransaction accounts={accounts} aiReady={aiReady} />
            </div>
            {children}
          </div>
        </div>
      </div>
    </CurrencyProvider>
  );
}
