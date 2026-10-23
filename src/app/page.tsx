import Link from "next/link";
import { ArrowRight, BookCheck, Download, ScanText } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/dal";

const sample = [
  { date: "01 Oct", what: "Salary, Acme Ltd", amount: "+3,200.00", balance: "4,418.20", gain: true },
  { date: "02 Oct", what: "Rent", amount: "−1,150.00", balance: "3,268.20" },
  { date: "04 Oct", what: "Groceries", amount: "−86.40", balance: "3,181.80" },
  { date: "05 Oct", what: "Transfer to Savings", amount: "−400.00", balance: "2,781.80", muted: true },
  { date: "07 Oct", what: "Coffee beans", amount: "−14.50", balance: "2,767.30" },
];

export default async function Landing() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5">
      <header className="flex items-center justify-between py-6">
        <Wordmark />
        <nav className="flex items-center gap-2" aria-label="Account">
          {user ? (
            <LinkButton href="/dashboard">Open your ledger <ArrowRight size={16} /></LinkButton>
          ) : (
            <>
              <LinkButton href="/sign-in" variant="ghost">Sign in</LinkButton>
              <LinkButton href="/sign-up">Get started</LinkButton>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1">
        <section className="grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div className="rise">
            <p className="eyebrow mb-4">Personal finance, kept honest</p>
            <h1 className="display text-[3.2rem] leading-[1.02] sm:text-[4.4rem]">
              Your money, on <span className="italic text-accent">one ledger</span> that always adds up.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-2">
              Track accounts, budgets and goals. Snap a receipt or just type what you spent, then ask questions about your finances in plain English. Every balance is checked against the transactions behind it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href={user ? "/dashboard" : "/sign-up"} size="md" className="h-11 px-6">{user ? "Open your ledger" : "Create your ledger"} <ArrowRight size={16} /></LinkButton>
              {!user && <LinkButton href="/sign-in" variant="secondary" className="h-11 px-6">I have an account</LinkButton>}
            </div>
          </div>

          <figure className="rise rise-2" aria-label="Example ledger">
            <div className="overflow-hidden rounded-md border border-rule bg-surface shadow-[0_1px_0_var(--rule),0_24px_48px_-32px_rgb(0_0_0/0.35)]">
              <div className="flex items-baseline justify-between border-b border-rule px-5 py-4">
                <span className="display text-2xl">Main account</span>
                <span className="num text-sm text-ink-3">October</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="eyebrow text-left"><th className="px-5 py-2 font-semibold">Date</th><th className="py-2 font-semibold">Entry</th><th className="py-2 text-right font-semibold">Amount</th><th className="px-5 py-2 text-right font-semibold">Balance</th></tr>
                </thead>
                <tbody>
                  {sample.map((r) => (
                    <tr key={r.date} className="border-t border-rule/70">
                      <td className="num px-5 py-2.5 text-ink-3">{r.date}</td>
                      <td className={r.muted ? "py-2.5 text-ink-3" : "py-2.5"}>{r.what}</td>
                      <td className={`num py-2.5 text-right ${r.gain ? "text-gain" : r.muted ? "text-ink-3" : "text-loss"}`}>{r.amount}</td>
                      <td className="num px-5 py-2.5 text-right font-medium">{r.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <figcaption className="mt-3 text-xs text-ink-3">Sample data, shown to illustrate the running balance.</figcaption>
          </figure>
        </section>

        <section className="grid gap-10 border-t border-rule py-14 md:grid-cols-3" aria-label="Principles">
          {[
            { icon: <BookCheck size={20} />, title: "Every number reconciles", body: "Balances are maintained atomically and can be verified against your transactions at any time. If something drifts, you'll see it and can repair it." },
            { icon: <ScanText size={20} />, title: "AI that explains, never decides", body: "It reads receipts and understands questions. But the figures always come from your own data, and nothing is saved until you've reviewed it." },
            { icon: <Download size={20} />, title: "Yours to take with you", body: "Export your transactions as CSV or everything as JSON whenever you like. Delete your account and the data goes with it." },
          ].map((p) => (
            <div key={p.title}>
              <div className="mb-3 text-accent">{p.icon}</div>
              <h2 className="display text-2xl">{p.title}</h2>
              <p className="mt-2 text-ink-2">{p.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-rule py-6 text-sm text-ink-3">
        <span>© {new Date().getFullYear()} FinTrack</span>
        <Link href="/sign-in" className="hover:text-ink">Sign in</Link>
      </footer>
    </div>
  );
}
