import type { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: SectionCardProps) {
  return (
    <section
      className={`surface-card rounded-[14px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)] ${className}`}
    >
      {(title || eyebrow || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div>
            {eyebrow ? (
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--primary)]">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="text-base font-semibold text-[var(--foreground)]">
                {title}
              </h2>
            ) : null}
          </div>
          {action}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
