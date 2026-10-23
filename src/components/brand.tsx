import Link from "next/link";

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`display text-[1.7rem] leading-none tracking-tight ${className}`} aria-label="FinTrack home">
      Fin<span className="italic text-accent">Track</span>
    </Link>
  );
}
