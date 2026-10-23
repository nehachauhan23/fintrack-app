"use client";

import { ArrowUp, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMoney } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { localToday, useRun } from "@/lib/use-run";
import { askAssistantAction } from "@/server/actions/ai";
import type { AssistantAnswer, AssistantReply, Plan } from "@/server/ai/assistant";

type Turn = { id: number; question: string; reply?: AssistantReply; error?: string };

const SUGGESTIONS = [
  "How much did I spend on food last month?",
  "Where did my money go this month?",
  "What are my top 5 merchants this year?",
  "Compare my spending this month with last month",
  "How has my income changed over the last 6 months?",
];

export function AssistantChat({ used, limit, aiReady, reason }: { used: number; limit: number; aiReady: boolean; reason?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [remaining, setRemaining] = useState(limit > 0 ? Math.max(0, limit - used) : null);
  const { run, pending } = useRun();
  const end = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, pending]);

  const history = turns.flatMap((t) => (t.reply?.kind === "answer" ? [{ question: t.question, plan: t.reply.plan as Plan }] : [])).slice(-2);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || pending) return;
    const id = ++nextId.current;
    setTurns((t) => [...t, { id, question: q }]);
    setText("");
    run(() => askAssistantAction({ question: q, today: localToday(), history }), {
      refresh: false,
      onOk: (reply) => { setTurns((t) => t.map((x) => (x.id === id ? { ...x, reply } : x))); setRemaining((r) => (r === null ? r : Math.max(0, r - 1))); },
      onError: (e) => setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: e.message } : x))),
    });
  };

  if (!aiReady) return <Notice tone="warn">{reason}</Notice>;

  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-8" aria-live="polite">
        {turns.length === 0 && (
          <div className="space-y-4">
            <p className="max-w-xl text-ink-2">Ask in plain English. The assistant works out <em>what to look up</em>; the answer itself is calculated from your own transactions.</p>
            <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-rule bg-surface px-3.5 py-1.5 text-sm text-ink-2 transition hover:border-accent hover:text-ink">{s}</button>)}</div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className="space-y-3">
            <p className="display max-w-2xl text-[1.6rem] leading-snug">{t.question}</p>
            {!t.reply && !t.error && <p className="flex items-center gap-2 text-ink-3"><Loader2 className="animate-spin" size={15} /> Looking through your ledger…</p>}
            {t.error && <Notice tone="warn">{t.error}</Notice>}
            {t.reply?.kind === "unsupported" && <Notice>{t.reply.message}</Notice>}
            {t.reply?.kind === "answer" && <Answer a={t.reply} />}
          </div>
        ))}
        <div ref={end} />
      </div>

      <form className="sticky bottom-0 mt-8 border-t border-rule bg-paper/95 pb-2 pt-4 backdrop-blur" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <div className="flex gap-2">
          <input aria-label="Ask about your finances" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="e.g. How much did I spend on groceries in September?" className="h-11 flex-1 rounded-[5px] border border-rule bg-surface px-3 text-sm placeholder:text-ink-3 focus:border-accent" />
          <Button type="submit" className="h-11 w-11 p-0" disabled={pending || text.trim().length < 2 || remaining === 0} aria-label="Ask">{pending ? <Loader2 className="animate-spin" size={18} /> : <ArrowUp size={18} />}</Button>
        </div>
        <p className="mt-2 text-xs text-ink-3">{remaining === null ? "" : remaining === 0 ? "You've used today's AI requests; they reset tomorrow (UTC). " : `${remaining} AI request${remaining === 1 ? "" : "s"} left today. `}Each question uses one.</p>
      </form>
    </div>
  );
}

function Answer({ a }: { a: AssistantAnswer }) {
  const { fmt } = useMoney();
  const isCount = a.metric === "count";
  const show = (v: number) => (isCount ? String(v) : fmt(v, { signed: a.metric === "net" }));
  const max = Math.max(1, ...a.groups.map((g) => Math.abs(g.value)));
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-[1.05rem] leading-relaxed">{a.summary}</p>
      {a.groups.length > 0 && (
        <ul className="space-y-2.5">
          {a.groups.map((g) => (
            <li key={g.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="truncate font-medium">{g.label}</span><span className="num text-ink-2">{show(g.value)}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-rule"><div className={`h-full rounded-full ${g.value < 0 ? "bg-loss" : "bg-accent"}`} style={{ width: `${(Math.abs(g.value) / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
      {a.notes.map((n) => <p key={n} className="text-[13px] text-warn">{n}</p>)}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3"><ShieldCheck size={14} className="text-accent" aria-hidden /> Calculated from {a.count} transaction{a.count === 1 ? "" : "s"}, {formatDate(a.from)} to {formatDate(a.to)}<Link href={`/transactions?from=${a.from}&to=${a.to}${a.plan.categories.length === 1 ? `&category=${a.plan.categories[0]}` : ""}`} className="font-medium text-accent hover:underline">See them</Link></p>
    </div>
  );
}
