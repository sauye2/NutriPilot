import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  children,
  action,
  showPreview = false,
  className,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  showPreview?: boolean;
  className?: string;
}) {
  const visual = action ?? (showPreview ? <MacroGlassPreview /> : null);

  return (
    <section
      className={cn(
        visual
          ? "liquid-panel mb-6 grid min-h-[220px] gap-6 rounded-[34px] px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(260px,0.28fr)] lg:items-end"
          : "liquid-panel mb-6 rounded-[34px] px-5 py-6 sm:px-7 sm:py-8",
        className,
      )}
    >
      <div className="relative z-1 max-w-4xl">
        <p className="page-kicker mb-3">{eyebrow}</p>
        <h1 className="page-title max-w-3xl">{title}</h1>
        {children ? <div className="page-copy mt-4 max-w-xl">{children}</div> : null}
      </div>
      {visual ? <div className="relative z-1 hidden justify-self-end lg:block">{visual}</div> : null}
    </section>
  );
}

function MacroGlassPreview() {
  return (
    <div
      aria-hidden="true"
      className="w-[270px] rounded-[28px] border border-white/60 bg-white/26 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_20px_48px_rgba(54,45,31,0.11)] backdrop-blur-2xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="h-2 w-16 rounded-full bg-[var(--primary)]/50" />
        <span className="size-8 rounded-full border border-white/60 bg-white/42" />
      </div>
      <div className="space-y-3">
        <PreviewBar width="82%" color="bg-[var(--primary)]/72" />
        <PreviewBar width="58%" color="bg-[#3976a6]/62" />
        <PreviewBar width="70%" color="bg-[#b07b3d]/58" />
        <PreviewBar width="42%" color="bg-[#96647b]/56" />
      </div>
    </div>
  );
}

function PreviewBar({ width, color }: { width: string; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="h-2 w-14 rounded-full bg-white/52" />
        <span className="h-2 w-8 rounded-full bg-white/42" />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/36 shadow-inner">
        <div className={`h-full rounded-full ${color}`} style={{ width }} />
      </div>
    </div>
  );
}

export function MetricTile({
  label,
  value,
  helper,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "neutral" | "green" | "blue" | "amber" | "rose";
  className?: string;
}) {
  const toneClass = {
    neutral: "from-white/60 to-[#faf4ec]/40",
    green: "from-[#f2faf5]/70 to-[#e4f2ea]/45",
    blue: "from-[#f0f6fb]/70 to-[#e4eef7]/45",
    amber: "from-[#fbf4e8]/70 to-[#f4e8d4]/45",
    rose: "from-[#faf0f2]/70 to-[#f3e4e8]/45",
  }[tone];

  return (
    <div
      className={cn(
        "metric-surface rounded-[20px] bg-gradient-to-b px-4 py-4 transition duration-200 hover:-translate-y-0.5",
        toneClass,
        className,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        {value}
      </p>
      {helper ? <p className="mt-1 text-xs text-[var(--muted)]">{helper}</p> : null}
    </div>
  );
}

export function StatusBadge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "neutral" | "rose";
}) {
  const toneClass = {
    green: "border-[var(--primary-soft)] bg-[var(--primary-soft)] text-[var(--primary-strong)]",
    amber: "border-[var(--warning-soft)] bg-[var(--warning-soft)] text-[var(--warning)]",
    rose: "border-[var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger)]",
    neutral: "border-[var(--border)] bg-[var(--muted-soft)] text-[var(--muted)]",
  }[tone];

  return (
    <Badge
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]",
        toneClass,
      )}
    >
      {children}
    </Badge>
  );
}
