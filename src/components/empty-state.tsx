export function EmptyState() {
  return (
    <div className="rounded-[18px] border border-dashed border-[var(--border)] bg-[var(--muted-soft)]/78 px-5 py-10 text-center shadow-inner">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-white/80 text-xl font-semibold text-[var(--primary)] shadow-sm">
        +
      </div>
      <p className="text-sm font-medium text-[var(--foreground)]">
        Start with a few ingredients and we&apos;ll total everything up for you.
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
        Search for what you&apos;re cooking, add the amounts you plan to use, and
        NutriPilot will pull together the meal summary, goal check, and a few
        practical tweaks.
      </p>
    </div>
  );
}
