import { cn } from "@/lib/utils";

const control = "w-full rounded-[5px] border border-rule bg-surface px-3 text-sm text-ink placeholder:text-ink-3 transition focus:border-accent disabled:opacity-60";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("mb-1 block text-[13px] font-medium text-ink-2", className)} {...props} />;
}
export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}
export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-20 py-2", className)} {...props} />;
}
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-10 appearance-none bg-no-repeat pr-8", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%2378848e' stroke-width='1.6'%3E%3Cpath d='m1 1.5 5 5 5-5'/%3E%3C/svg%3E\")", backgroundPosition: "right 0.75rem center" }} {...props}>
      {children}
    </select>
  );
}

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p role="alert" className="mt-1 text-[13px] text-loss">{messages[0]}</p>;
}

export function Field({ label, htmlFor, errors, hint, children, className }: { label: string; htmlFor?: string; errors?: string[]; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !errors?.length && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
      <FieldError messages={errors} />
    </div>
  );
}
