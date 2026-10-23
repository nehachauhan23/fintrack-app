import type { Metadata } from "next";
import { Download } from "lucide-react";
import { env } from "@/env";
import { LinkButton } from "@/components/ui/button";
import { Notice, PageHeader, Section } from "@/components/ui/misc";
import { DangerZone, PasswordForm, PreferenceToggles, ProfileForm, SessionsList } from "@/features/settings/settings-forms";
import { aiConfigured } from "@/server/ai/openrouter";
import { aiUsageToday } from "@/server/ai/quota";
import { requireUser } from "@/server/auth/dal";
import { listSessions } from "@/server/services/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [sessions, usage] = await Promise.all([listSessions(user.id, user.sessionId), aiUsageToday(user.id)]);
  const strict = env.OPENROUTER_DATA_COLLECTION === "deny";

  return (
    <>
      <PageHeader title="Settings" description={user.email} />
      <div className="space-y-12">
        <Section title="Profile"><ProfileForm name={user.name} currency={user.currency} /></Section>
        <Section title="Preferences"><PreferenceToggles emailAlerts={user.emailAlerts} aiEnabled={user.aiEnabled} /></Section>

        <Section title="AI and your data">
          <div className="max-w-2xl space-y-4 text-ink-2">
            {!aiConfigured() && <Notice tone="warn">AI isn&apos;t configured on this server (no <code>OPENROUTER_API_KEY</code>), so AI features are unavailable. Everything else works.</Notice>}
            <p>AI requests go to <strong className="text-ink">OpenRouter</strong>. Here is exactly what can leave this app:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong className="text-ink">Receipt photos</strong>: shrunk on your device, sent once, never stored. Location and device metadata are stripped.</li>
              <li><strong className="text-ink">Text you type</strong> into “Describe it” or the assistant, plus your account names and today&apos;s date so it can resolve “yesterday”.</li>
              <li><strong className="text-ink">Merchant descriptions</strong> of uncategorised transactions, when you ask for categories.</li>
              <li><strong className="text-ink">Monthly totals</strong> (income, spending, category amounts) for AI reviews. No individual transactions, no merchants.</li>
            </ul>
            <p>It never sends your name, email, password, balances or transaction history. {strict ? "Providers that retain or train on prompts are excluded." : <strong className="text-warn">This server allows providers that may log prompts.</strong>}</p>
            <p>AI only reads and proposes. It cannot change anything: you review every suggestion, and every number in an answer is calculated from your own data.</p>
            {usage.limit > 0 && <p className="text-sm text-ink-3">AI requests used today: <span className="num font-medium text-ink">{usage.used}</span> of {usage.limit} (resets at midnight UTC).</p>}
          </div>
        </Section>

        <Section title="Password"><PasswordForm /></Section>
        <Section title="Where you're signed in"><SessionsList sessions={sessions} /></Section>

        <Section title="Your data">
          <p className="mb-3 max-w-xl text-ink-2">Take everything with you at any time.</p>
          <div className="flex flex-wrap gap-2"><LinkButton variant="secondary" href="/api/export/transactions"><Download size={16} /> Transactions (CSV)</LinkButton><LinkButton variant="secondary" href="/api/export/data"><Download size={16} /> Everything (JSON)</LinkButton></div>
        </Section>

        <Section title="Danger zone"><DangerZone /></Section>
      </div>
    </>
  );
}
