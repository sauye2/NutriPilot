"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";

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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isProfileOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isProfileOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    setIsProfileOpen(false);
    router.refresh();
    router.push("/dashboard");
    setIsSigningOut(false);
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/dashboard" className="group flex items-center gap-3">
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
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-[10px] px-3 py-2 text-sm font-medium transition duration-200 active:scale-[0.99] ${
                  isActive
                    ? "bg-[var(--muted-soft)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="ml-2 flex items-center gap-2 border-l border-[var(--border)] pl-2">
            {isLoading ? (
              <span className="px-3 py-2 text-sm text-[var(--muted)]">Loading...</span>
            ) : user ? (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isProfileOpen}
                  className="grid size-10 place-items-center rounded-full border border-[var(--border)] bg-white text-sm font-semibold text-[var(--foreground)] shadow-sm transition duration-200 hover:border-[var(--primary-soft)] hover:bg-[var(--muted-soft)] active:scale-[0.99]"
                  onClick={() => setIsProfileOpen((current) => !current)}
                >
                  <ProfileIcon />
                </button>

                {isProfileOpen ? (
                  <div className="absolute right-0 top-[calc(100%+10px)] w-64 rounded-[16px] border border-[var(--border)] bg-white p-3 shadow-[var(--shadow)]">
                    <div className="flex items-center gap-3 rounded-[12px] bg-[var(--muted-soft)] px-3 py-3">
                      <span className="grid size-10 place-items-center rounded-full bg-[var(--primary)] text-white">
                        <ProfileIcon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          Signed in
                        </p>
                        <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
                      </div>
                    </div>
                    <button
                      className="mt-3 rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99]"
                      type="button"
                      onClick={() => void handleSignOut()}
                    >
                      {isSigningOut ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                ) : null}
              </div>
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
