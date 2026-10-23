import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/dal";
import { SignUpForm } from "@/features/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <>
      <h1 className="display text-4xl">Start your ledger</h1>
      <p className="mb-8 mt-1 text-ink-2">Free to use. It takes a minute.</p>
      <SignUpForm />
      <p className="mt-6 text-sm text-ink-2">Already registered? <Link href="/sign-in" className="font-medium text-accent underline-offset-4 hover:underline">Sign in</Link></p>
    </>
  );
}
