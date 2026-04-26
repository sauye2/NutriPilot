import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32 rounded-full bg-[var(--muted-soft)]" />
      <Skeleton className="h-11 rounded-[14px] bg-[var(--muted-soft)]" />
      <Skeleton className="h-11 rounded-[14px] bg-[var(--muted-soft)]" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Alert className="rounded-[14px] border-[var(--danger-soft)] bg-[var(--danger-soft)] text-[var(--danger)]">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
