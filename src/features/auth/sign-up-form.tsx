"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useRun } from "@/lib/use-run";
import { signUpAction } from "@/server/actions/auth";

export function SignUpForm() {
  const router = useRouter();
  const { run, pending, errors } = useRun();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run(() => signUpAction({ name, email, password }), { refresh: false, onOk: () => { router.replace("/dashboard"); router.refresh(); } });
      }}
    >
      <Field label="Your name" htmlFor="name" errors={errors.name}>
        <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} autoFocus />
      </Field>
      <Field label="Email" htmlFor="email" errors={errors.email}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
      </Field>
      <Field label="Password" htmlFor="password" errors={errors.password} hint="At least 10 characters. A few random words work well.">
        <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending || !name || !email || !password}>
        {pending && <Loader2 className="animate-spin" size={16} />} Create account
      </Button>
    </form>
  );
}
