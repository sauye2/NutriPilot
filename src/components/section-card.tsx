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
      className={`rounded-[8px] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)] ${className}`}
    >
      {(title || eyebrow || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div>
            {eyebrow ? (
              <p className="mb-1 text-xs font-semibold uppercase text-[var(--primary)]">
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
      <div className="p-5">{children}</div>
    </section>
  );
}
