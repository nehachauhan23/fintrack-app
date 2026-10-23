"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ title, description, children, className, wide }: { title: string; description?: string; children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]" />
      <D.Content
        className={cn("fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-rule bg-surface p-6 shadow-xl", wide ? "max-w-2xl" : "max-w-md", className)}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <D.Title className="display text-2xl leading-tight">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-ink-2">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close aria-label="Close" className="rounded p-1 text-ink-3 hover:bg-paper hover:text-ink"><X size={18} /></D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
