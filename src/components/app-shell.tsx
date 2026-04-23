import Link from "next/link";
import type { ReactNode } from "react";

const navItems = [
  { href: "/meal-builder", label: "Meal Builder" },
  { href: "/import-recipe", label: "Import Recipe" },
  { href: "/generate-meal", label: "Lazy Mode" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/meal-builder" className="group flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[8px] bg-[var(--primary)] text-base font-semibold text-white shadow-sm transition group-hover:bg-[var(--primary-strong)]">
            N
          </span>
          <span>
            <span className="block text-lg font-semibold leading-tight text-[var(--foreground)]">
              NutriPilot
            </span>
            <span className="hidden text-xs text-[var(--muted)] sm:block">
              Calculate and optimize meals you already want to cook
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 rounded-[8px] border border-[var(--border)] bg-white/60 p-1 shadow-sm backdrop-blur md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[7px] px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
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
