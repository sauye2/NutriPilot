export function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--muted-soft)]" />
      <div className="h-10 animate-pulse rounded-[8px] bg-[var(--muted-soft)]" />
      <div className="h-10 animate-pulse rounded-[8px] bg-[var(--muted-soft)]" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
      {message}
    </div>
  );
}
