import { Wordmark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
      <aside className="hidden flex-col justify-between border-r border-rule bg-accent px-12 py-10 text-accent-ink lg:flex">
        <Wordmark href="/" className="text-accent-ink [&_span]:text-accent-ink" />
        <div>
          <p className="display text-5xl leading-[1.05]">A ledger you can trust to add up.</p>
          <p className="mt-4 max-w-sm opacity-80">Accounts, budgets, goals and a plain-English assistant, with every balance verified against the entries behind it.</p>
        </div>
        <p className="text-sm opacity-70">Your data stays yours: export or delete it any time.</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Wordmark /></div>
          {children}
        </div>
      </main>
    </div>
  );
}
