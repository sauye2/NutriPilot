"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { useAuth } from "@/components/auth-provider";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { supabase } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (isSignup && password !== confirmPassword) {
      setError("Those passwords don’t match yet.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
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

        setSuccess("Account created. Check your email if Supabase asks you to confirm it.");
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
        <section className="mb-8 max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase text-[var(--primary)]">
            {isSignup ? "Create your account" : "Welcome back"}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            {isSignup
              ? "Keep your meals, goals, and daily logs in one place."
              : "Pick up right where you left off."}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            NutriPilot still works without an account for quick calculations. Signing in
            makes it easier to save meals, keep your goals handy, and build a real
            history in the dashboard.
          </p>
        </section>

        <SectionCard
          title={isSignup ? "Sign Up" : "Log In"}
          eyebrow={isSignup ? "Cloud saving" : "Your NutriPilot account"}
        >
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--foreground)]">
                Email
              </span>
              <input
                className="focus-ring h-12 w-full rounded-[12px] border border-[var(--border)] bg-white px-4 text-sm text-[var(--foreground)]"
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
                className="focus-ring h-12 w-full rounded-[12px] border border-[var(--border)] bg-white px-4 text-sm text-[var(--foreground)]"
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
                  className="focus-ring h-12 w-full rounded-[12px] border border-[var(--border)] bg-white px-4 text-sm text-[var(--foreground)]"
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

            {success ? (
              <div className="rounded-[12px] border border-[var(--primary-soft)] bg-[var(--muted-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
                {success}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-[12px] bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || !email || !password || (isSignup && !confirmPassword)}
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
        </SectionCard>
      </div>
    </AppShell>
  );
}
