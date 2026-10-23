import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/dal";
import { safeNext } from "@/lib/safe-redirect";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next));
  return (
    <>
      <h1 className="display text-4xl">Welcome back</h1>
      <p className="mb-8 mt-1 text-ink-2">Sign in to your ledger.</p>
      <SignInForm next={safeNext(next)} />
      <p className="mt-6 text-sm text-ink-2">New here? <Link href="/sign-up" className="font-medium text-accent underline-offset-4 hover:underline">Create an account</Link></p>
    </>
  );
}
