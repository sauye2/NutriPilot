"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { GroceryListPanel } from "@/components/grocery-list-panel";
import { readAcceptedGeneratedMeal } from "@/lib/generated-meal-storage";

export function ShoppingListClient() {
  const meal = readAcceptedGeneratedMeal();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-5 pb-12 pt-4 sm:px-8">
        <section className="mb-8 max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase text-[var(--primary)]">
            Shopping List
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            Grocery list for your accepted AI meal.
          </h1>
        </section>

        {meal ? (
          <GroceryListPanel meal={meal} heading={`${meal.title} Grocery List`} />
        ) : (
          <section className="rounded-[8px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[var(--shadow)]">
            <p className="text-sm font-medium text-[var(--foreground)]">
              No accepted generated meal yet.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Generate and accept a meal in Lazy Mode first, then the grocery list will
              appear here.
            </p>
            <Link
              className="mt-4 inline-flex rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
              href="/generate-meal"
            >
              Go to Lazy Mode
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
