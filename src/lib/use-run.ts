"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionError, ActionResult } from "@/lib/result";

interface RunOptions<T> {
  success?: string;
  onOk?: (data: T) => void;
  onError?: (error: ActionError) => void;
  /** Re-fetch server components after success (default true). */
  refresh?: boolean;
}

/** Calls a server action with a pending flag, toasts, field errors and a router refresh. */
export function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const run = useCallback(
    <T,>(work: () => Promise<ActionResult<T>>, opts: RunOptions<T> = {}) => {
      setErrors({});
      start(async () => {
        const result = await work();
        if (result.ok) {
          if (opts.success) toast.success(opts.success);
          opts.onOk?.(result.data);
          if (opts.refresh !== false) router.refresh();
        } else {
          setErrors(result.error.fieldErrors ?? {});
          if (!result.error.fieldErrors || result.error.code !== "VALIDATION") toast.error(result.error.message);
          opts.onError?.(result.error);
        }
      });
    },
    [router],
  );
  return { run, pending, errors, clearErrors: () => setErrors({}) };
}

/** Today's date in the browser's own time zone, as YYYY-MM-DD. Used for date defaults and AI date resolution. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
