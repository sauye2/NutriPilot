"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/nutrition-ui";
import { SectionCard } from "@/components/section-card";
import { useAuth } from "@/components/auth-provider";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { supabase } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didCreateAccount, setDidCreateAccount] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isSignup && password !== confirmPassword) {
      setError("Those passwords don't match yet.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.session) {
          router.push("/dashboard");
          router.refresh();
          return;
        }

        setDidCreateAccount(true);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-5 pb-12 pt-8 sm:px-8">
        <PageHeader
          eyebrow={isSignup ? "Create your account" : "Welcome back"}
          title={
            isSignup
              ? "Keep your meals, goals, and daily logs in one place."
              : "Pick up right where you left off."
          }
        >
          <p>
            NutriPilot still works without an account for quick calculations. Signing in
            makes it easier to save meals, keep your goals handy, and build a real
            history in the dashboard.
          </p>
        </PageHeader>

        <SectionCard
          title={isSignup ? "Sign Up" : "Log In"}
          eyebrow={isSignup ? "Cloud saving" : "Your NutriPilot account"}
        >
          {didCreateAccount ? (
            <div className="rounded-[16px] border border-[var(--primary-soft)] bg-[var(--muted-soft)] px-5 py-6">
              <div className="flex items-start gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--primary)]/12 text-[var(--primary)]">
                  <svg
                    aria-hidden="true"
                    className="size-5"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.5 10.5L8.1 14L15.5 6.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-[var(--foreground)]">
                    Account created
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    Check your email to confirm your account, then come back here to
                    log in.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Link
                      href="/login"
                      className="rounded-[12px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99]"
                    >
                      Log in
                    </Link>
                    <button
                      type="button"
                      className="rounded-[12px] border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99]"
                      onClick={() => setDidCreateAccount(false)}
                    >
                      Edit details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                  Email
                </span>
                <input
                  className="focus-ring soft-input h-12 w-full rounded-[14px] border px-4 text-sm text-[var(--foreground)]"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                  Password
                </span>
                <input
                  className="focus-ring soft-input h-12 w-full rounded-[14px] border px-4 text-sm text-[var(--foreground)]"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              {isSignup ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                    Confirm password
                  </span>
                  <input
                    className="focus-ring soft-input h-12 w-full rounded-[14px] border px-4 text-sm text-[var(--foreground)]"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </label>
              ) : null}

              {error ? (
                <div className="rounded-[12px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-[12px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    isSubmitting || !email || !password || (isSignup && !confirmPassword)
                  }
                  type="submit"
                >
                  {isSubmitting
                    ? isSignup
                      ? "Creating account..."
                      : "Logging in..."
                    : isSignup
                      ? "Create account"
                      : "Log in"}
                </button>

                <p className="text-sm text-[var(--muted)]">
                  {isSignup ? "Already have an account?" : "Need an account?"}{" "}
                  <Link
                    href={isSignup ? "/login" : "/signup"}
                    className="font-semibold text-[var(--primary)]"
                  >
                    {isSignup ? "Log in" : "Sign up"}
                  </Link>
                </p>
              </div>
            </form>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
