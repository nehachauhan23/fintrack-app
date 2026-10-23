"use client";

import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRun } from "@/lib/use-run";
import { cleanUpCategoriesAction } from "@/server/actions/ai";

export function TidyButton() {
  const { run, pending } = useRun();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      title="Re-file recent transactions sitting in “Other”"
      onClick={() => run(() => cleanUpCategoriesAction({}), { onOk: (r) => { if (r.aiError) toast.warning(r.aiError); toast.success(r.checked === 0 ? "Nothing in “Other” to tidy" : `Re-filed ${r.changed} of ${r.checked}`); } })}
    >
      {pending ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Tidy categories
    </Button>
  );
}
