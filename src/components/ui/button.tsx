import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 active:brightness-95",
  secondary: "border border-rule bg-surface text-ink hover:bg-paper",
  ghost: "text-ink-2 hover:bg-accent-soft hover:text-ink",
  danger: "border border-loss/40 bg-surface text-loss hover:bg-loss-soft",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  icon: "h-8 w-8 p-0",
};

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: React.ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={cn("inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[5px] font-medium transition disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

export function LinkButton({ variant = "primary", size = "md", className, ...props }: React.ComponentProps<"a"> & { variant?: Variant; size?: Size }) {
  return <a className={cn("inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[5px] font-medium transition", variants[variant], sizes[size], className)} {...props} />;
}
