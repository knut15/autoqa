import type { Progress } from "@/lib/api-types";

export function isBusy(progress: Progress | null): boolean {
  return (
    progress !== null &&
    progress.phase !== "done" &&
    progress.phase !== "failed"
  );
}
