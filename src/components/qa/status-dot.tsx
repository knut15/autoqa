import { cn } from "@/lib/utils";
import type { TcStatus } from "@/lib/testcases";

// 색 + 모양을 항상 병행한다: green↔red 는 적록색약(deutan)에서 ΔE 4.1 로
// 구분 불가라서, 실패는 다이아몬드·통과는 원으로 모양이 상태를 함께 전달한다.
export const STATUS_META: Record<TcStatus, { label: string; dot: string }> = {
  pass: { label: "통과", dot: "rounded-full bg-status-pass" },
  fail: { label: "실패", dot: "rotate-45 rounded-[3px] bg-status-fail" },
  running: {
    label: "진행 중",
    dot: "rounded-full bg-status-running motion-safe:animate-pulse",
  },
  pending: {
    label: "대기",
    dot: "rounded-full border-[1.5px] border-muted-foreground/50",
  },
  skipped: { label: "건너뜀", dot: "rounded-full bg-status-skipped/70" },
};

export function StatusDot({
  status,
  className,
}: {
  status: TcStatus;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3 shrink-0",
        STATUS_META[status].dot,
        className
      )}
    />
  );
}
