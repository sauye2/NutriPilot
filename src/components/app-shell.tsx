 "use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";

const navItems = [
  { href: "/meal-builder", label: "Meal Builder" },
  { href: "/import-recipe", label: "Import Recipe" },
  { href: "/generate-meal", label: "Build a Meal for Me" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { supabase, user, isLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.refresh();
    router.push("/meal-builder");
    setIsSigningOut(false);
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/meal-builder" className="group flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-[var(--primary)] text-base font-semibold text-white shadow-sm transition duration-200 group-hover:scale-[1.02] group-hover:bg-[var(--primary-strong)]">
            N
          </span>
          <span>
            <span className="block text-lg font-semibold leading-tight text-[var(--foreground)]">
              NutriPilot
            </span>
            <span className="hidden text-xs text-[var(--muted)] sm:block">
              Meal planning support that feels calm, clear, and practical
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 rounded-[12px] border border-[var(--border)] bg-white/75 p-1 shadow-sm backdrop-blur md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[10px] px-3 py-2 text-sm font-medium text-[var(--muted)] transition duration-200 hover:bg-white hover:text-[var(--foreground)] active:scale-[0.99]"
            >
              {item.label}
            </Link>
          ))}
          <div className="ml-2 flex items-center gap-2 border-l border-[var(--border)] pl-2">
            {isLoading ? (
              <span className="px-3 py-2 text-sm text-[var(--muted)]">Loading...</span>
            ) : user ? (
              <>
                <span className="hidden rounded-[10px] bg-[var(--muted-soft)] px-3 py-2 text-sm text-[var(--muted)] lg:block">
                  {user.email}
                </span>
                <button
                  className="rounded-[10px] px-3 py-2 text-sm font-medium text-[var(--muted)] transition duration-200 hover:bg-white hover:text-[var(--foreground)] active:scale-[0.99]"
                  type="button"
                  onClick={() => void handleSignOut()}
                >
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-[10px] px-3 py-2 text-sm font-medium text-[var(--muted)] transition duration-200 hover:bg-white hover:text-[var(--foreground)] active:scale-[0.99]"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-[10px] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99]"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
