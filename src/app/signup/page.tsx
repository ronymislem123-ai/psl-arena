import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { countAccounts, getCurrentUser, isSignupAllowed } from "@/server/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/");
  return <AuthForm mode="signup" next={next} signupAllowed={isSignupAllowed()} firstAccount={countAccounts() === 0} />;
}
