import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/meal-builder", label: "Meal Builder" },
  { href: "/import-recipe", label: "Import Recipe" },
  { href: "/generate-meal", label: "Build a Meal for Me" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppShell({ children }: { children: ReactNode }) {
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
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
