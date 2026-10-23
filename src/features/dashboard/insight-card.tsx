"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Notice } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { useRun } from "@/lib/use-run";
import { getInsightAction } from "@/server/actions/ai";
import type { InsightResult } from "@/server/ai/insights";

const toneDot = { good: "bg-gain", watch: "bg-warn", neutral: "bg-ink-3" } as const;

export function InsightCard({ initial, period }: { initial: InsightResult; period: string }) {
  const [insight, setInsight] = useState(initial);
  const { run, pending } = useRun();
  const generate = () => run(() => getInsightAction({ period, refresh: true }), { refresh: false, onOk: setInsight });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {insight.source === "ai" ? <Badge tone="accent"><Sparkles size={11} /> AI review</Badge> : <Badge>Summary from your numbers</Badge>}
        {insight.source === "ai" && insight.stale && <Badge tone="warn">Numbers changed since this was written</Badge>}
        <span className="flex-1" />
        {insight.aiAvailable ? (
          <Button variant="secondary" size="sm" onClick={generate} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" size={14} /> : insight.source === "ai" ? <RefreshCw size={14} /> : <Sparkles size={14} />}
            {insight.source === "ai" ? "Refresh review" : "Write an AI review"}
          </Button>
        ) : (
          <span className="text-xs text-ink-3">AI review is off</span>
        )}
      </div>
      {insight.aiError && <div className="mb-4"><Notice tone="warn">{insight.aiError}</Notice></div>}
      <p className="display text-[1.75rem] leading-snug">{insight.headline}</p>
      <ul className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
        {insight.insights.map((i) => (
          <li key={i.title} className="flex gap-3">
            <i aria-hidden className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", toneDot[i.tone])} />
            <div><p className="font-medium">{i.title}</p><p className="text-ink-2">{i.detail}</p></div>
          </li>
        ))}
      </ul>
      {insight.tips.length > 0 && (
        <div className="mt-5 border-t border-rule pt-4">
          <p className="eyebrow mb-2">Worth trying</p>
          <ul className="list-disc space-y-1 pl-5 text-ink-2">{insight.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
