import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  allowOverflow?: boolean;
};

export function SectionCard({
  title,
  eyebrow,
  action,
  children,
  className = "",
  allowOverflow = false,
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        "surface-card premium-card gap-0 rounded-[24px] py-0",
        allowOverflow && "overflow-visible",
        className,
      )}
    >
      {(title || eyebrow || action) && (
        <CardHeader className="premium-card-header relative z-1 flex items-start justify-between gap-4 border-b border-white/45 px-5 py-3 sm:px-6">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--primary-strong)]">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="text-base font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                {title}
              </h2>
            ) : null}
          </div>
          {action ? <div className="shrink-0 self-center">{action}</div> : null}
        </CardHeader>
      )}
      <CardContent className="relative z-1 px-5 pb-3.5 pt-2.5 sm:px-6 sm:pb-4 sm:pt-3">
        {children}
      </CardContent>
    </Card>
  );
}
