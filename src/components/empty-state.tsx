export function EmptyState() {
  return (
    <div className="rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--muted-soft)] px-5 py-10 text-center">
      <p className="text-sm font-medium text-[var(--foreground)]">
        Start with a few ingredients and we’ll total everything up for you.
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
        Search for what you’re cooking, add the amounts you plan to use, and
        NutriPilot will pull together the meal summary, goal check, and a few
        practical tweaks.
      </p>
    </div>
  );
}
