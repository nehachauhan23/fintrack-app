"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useRun } from "@/lib/use-run";
import { signInAction, signInDemo } from "@/server/actions/auth";

export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const { run, pending, errors } = useRun();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => signInAction({ email, password }), {
          refresh: false,
          onOk: () => {
            router.replace(next);
            router.refresh();
          },
        });
      }}
    >
      <Field label="Email" htmlFor="email" errors={errors.email}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
          autoFocus
        />
      </Field>
      <Field label="Password" htmlFor="password" errors={errors.password}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
        />
      </Field>
      <Button
        type="submit"
        className="w-full"
        disabled={pending || !email || !password}
      >
        {pending && <Loader2 className="animate-spin" size={16} />} Sign in
      </Button>
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={() =>
          run(() => signInDemo(), {
            refresh: false,
            onOk: () => {
              router.replace(next);
              router.refresh();
            },
          })
        }
      >
        Try Demo
      </Button>
    </form>
  );
}
