"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/meal-builder", label: "Meal Builder" },
  { href: "/generate-meal", label: "Build a Meal for Me" },
  { href: "/import-recipe", label: "Import Recipe" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { supabase, user, isLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.refresh();
    router.push("/dashboard");
    setIsSigningOut(false);
  }

  return (
    <div className="premium-shell min-h-screen">
      <header className="sticky top-0 z-50 border-b border-white/35 bg-[var(--background)]/54 shadow-[0_12px_34px_rgba(54,45,31,0.05)] backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[16px] bg-[var(--primary)] text-base font-semibold text-white shadow-[0_12px_28px_rgba(34,116,95,0.24)] transition duration-200 group-hover:scale-[1.02] group-hover:bg-[var(--primary-strong)]">
            N
          </span>
          <span>
            <span className="block text-lg font-semibold leading-tight tracking-[-0.02em] text-[var(--foreground)]">
              NutriPilot
            </span>
            <span className="hidden text-xs text-[var(--muted)] sm:block">
              Calm meal planning, practical nutrition
            </span>
          </span>
        </Link>

        <nav className="order-3 flex w-full max-w-full flex-wrap items-center gap-1 rounded-[18px] border border-white/55 bg-white/42 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-2xl md:order-none md:w-auto md:flex-nowrap">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-[12px] px-3 py-2 text-sm font-medium transition duration-200 active:scale-[0.99] ${
                  isActive
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "text-[var(--muted)] hover:bg-white/80 hover:text-[var(--foreground)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="ml-1 flex items-center gap-2 border-l border-[var(--border)] pl-2">
            {isLoading ? (
              <span className="px-3 py-2 text-sm text-[var(--muted)]">Loading...</span>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid size-10 place-items-center rounded-full border border-[var(--border)] bg-white text-sm font-semibold text-[var(--foreground)] shadow-sm transition duration-200 hover:border-[var(--primary-soft)] hover:bg-[var(--muted-soft)] active:scale-[0.99]"
                  >
                    <ProfileIcon />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-[18px] border-[var(--border)] bg-[var(--card)] p-2 shadow-[var(--shadow)]"
                >
                  <DropdownMenuLabel className="rounded-[14px] bg-[var(--muted-soft)] p-3">
                    <span className="block text-sm font-semibold text-[var(--foreground)]">
                      Signed in
                    </span>
                    <span className="block truncate text-xs font-normal text-[var(--muted)]">
                      {user.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="rounded-[12px] px-3 py-2 text-sm font-semibold"
                    onClick={() => void handleSignOut()}
                  >
                    {isSigningOut ? "Signing out..." : "Sign out"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link
                  href="/login"
                  className="whitespace-nowrap rounded-[12px] px-3 py-2 text-sm font-medium text-[var(--muted)] transition duration-200 hover:bg-white hover:text-[var(--foreground)] active:scale-[0.99]"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="whitespace-nowrap rounded-[12px] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99]"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

function ProfileIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 10.25C12.0711 10.25 13.75 8.57107 13.75 6.5C13.75 4.42893 12.0711 2.75 10 2.75C7.92893 2.75 6.25 4.42893 6.25 6.5C6.25 8.57107 7.92893 10.25 10 10.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.75 16.5C4.76435 14.1768 7.10499 12.75 10 12.75C12.895 12.75 15.2357 14.1768 16.25 16.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
