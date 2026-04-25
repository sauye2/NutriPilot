import Link from "next/link";

export function SignInPrompt({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--border)] bg-[var(--muted-soft)] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
      <p>{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          className="rounded-[10px] bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--primary-strong)] active:scale-[0.99]"
          href="/login"
        >
          Log in
        </Link>
        <Link
          className="rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition duration-200 hover:bg-[var(--muted-soft)] active:scale-[0.99]"
          href="/signup"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
