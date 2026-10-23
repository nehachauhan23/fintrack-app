import { cn } from "@/lib/utils";

export function Badge({ tone = "neutral", className, children }: { tone?: "neutral" | "accent" | "gain" | "loss" | "warn"; className?: string; children: React.ReactNode }) {
  const tones = { neutral: "bg-paper text-ink-2 border-rule", accent: "bg-accent-soft text-accent border-transparent", gain: "bg-gain-soft text-gain border-transparent", loss: "bg-loss-soft text-loss border-transparent", warn: "bg-warn-soft text-warn border-transparent" };
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight", tones[tone], className)}>{children}</span>;
}

export function Progress({ value, tone = "accent", label }: { value: number; tone?: "accent" | "warn" | "loss" | "gain"; label?: string }) {
  const bar = { accent: "bg-accent", warn: "bg-warn", loss: "bg-loss", gain: "bg-gain" }[tone];
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-1.5 w-full overflow-hidden rounded-full bg-rule">
      <div className={cn("h-full rounded-full transition-[width] duration-500", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-rule/70", className)} />;
}

/** A ruled section: a heading line, optional action, then content. Replaces the boxed "card". */
export function Section({ title, eyebrow, action, children, className }: { title?: string; eyebrow?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-rule pt-5", className)}>
      {(title || action || eyebrow) && (
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            {title && <h2 className="display text-[1.65rem] leading-none">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-[2.6rem] leading-[1.05]">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-ink-2">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-rule px-6 py-10">
      {icon && <div className="text-accent">{icon}</div>}
      <h3 className="display text-2xl">{title}</h3>
      <p className="max-w-md text-ink-2">{body}</p>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "gain" | "loss" }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={cn("num mt-1 text-2xl font-semibold tracking-tight", tone === "gain" && "text-gain", tone === "loss" && "text-loss")}>{value}</p>
      {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "neutral", children }: { tone?: "neutral" | "warn" | "loss" | "accent"; children: React.ReactNode }) {
  const tones = { neutral: "border-rule bg-surface", warn: "border-warn/40 bg-warn-soft text-ink", loss: "border-loss/40 bg-loss-soft text-ink", accent: "border-accent/30 bg-accent-soft text-ink" };
  return <div role="status" className={cn("rounded-md border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}
