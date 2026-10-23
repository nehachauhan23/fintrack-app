import { LinkButton } from "@/components/ui/button";
import { Wordmark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-4 px-6">
      <Wordmark />
      <h1 className="display text-5xl leading-tight">That page isn&apos;t in the ledger.</h1>
      <p className="text-ink-2">The link may be old, or the item was deleted.</p>
      <LinkButton href="/dashboard">Back to your overview</LinkButton>
    </main>
  );
}
