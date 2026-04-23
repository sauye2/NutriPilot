import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";

type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
};

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  bullets,
}: PlaceholderPageProps) {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl px-5 pb-12 pt-8 sm:px-8">
        <section className="mb-8 max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase text-[var(--primary)]">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-[var(--foreground)] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--muted)]">
            {description}
          </p>
        </section>

        <SectionCard
          title="Reserved for the next phase"
          action={
            <Link
              href="/meal-builder"
              className="rounded-[8px] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
            >
              Back to builder
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {bullets.map((bullet) => (
              <div
                key={bullet}
                className="rounded-[8px] border border-[var(--border)] bg-white/70 p-4 text-sm leading-6 text-[var(--muted)]"
              >
                {bullet}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
