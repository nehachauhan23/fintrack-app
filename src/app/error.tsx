"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="display text-4xl leading-tight">Something went wrong on our side.</h1>
      <p className="text-ink-2">Your data is safe. Try again, and if it keeps happening, mention this reference: <code className="num">{error.digest ?? "none"}</code>.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
