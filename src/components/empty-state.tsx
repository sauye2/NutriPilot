export function EmptyState() {
  return (
    <div className="rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--muted-soft)] px-4 py-8 text-center">
      <p className="text-sm font-medium text-[var(--foreground)]">
        Start with one ingredient.
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
        Add foods from the starter dataset and NutriPilot will calculate totals,
        compare goals, and suggest practical changes.
      </p>
    </div>
  );
}
