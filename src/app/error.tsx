"use client";

import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { ErrorState } from "@/components/status-states";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
        <SectionCard title="Something went sideways">
          <ErrorState message="NutriPilot could not load this view. Your meal data is local to the page, so try refreshing or returning to the builder." />
          <button
            className="mt-4 rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
            type="button"
            onClick={reset}
          >
            Try again
          </button>
        </SectionCard>
      </div>
    </AppShell>
  );
}
