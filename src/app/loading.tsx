import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { LoadingState } from "@/components/status-states";

export default function Loading() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
        <SectionCard title="Preparing Calora">
          <LoadingState />
        </SectionCard>
      </div>
    </AppShell>
  );
}
