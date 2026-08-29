import { cn } from "@/lib/utils";
import type { TcStatus } from "@/lib/testcases";

// 색 + 모양을 항상 병행한다: green↔red 는 적록색약(deutan)에서 ΔE 4.1 로
// 구분 불가라서 모양이 상태를 함께 전달한다.
// 통과=원 · 실패=다이아몬드 · 보류=원(앰버) · 진행 중=원+링 · 대기=빈 원
export const STATUS_META: Record<TcStatus, { label: string; dot: string }> = {
  pass: { label: "통과", dot: "rounded-full bg-status-pass" },
  fail: { label: "실패", dot: "rotate-45 rounded-[3px] bg-status-fail" },
  running: {
    // 139 개 중에서 지금 어느 것을 보고 있는지 한눈에 찾혀야 한다.
    // 펄스만으로는 묻히므로 링을 둘러 시선을 잡는다.
    label: "진행 중",
    dot: "rounded-full bg-status-running ring-2 ring-status-running/50 motion-safe:animate-pulse",
  },
  pending: {
    label: "대기",
    dot: "rounded-full border-[1.5px] border-muted-foreground/50",
  },
  skipped: { label: "보류", dot: "rounded-full bg-status-skipped" },
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
        className,
      )}
    />
  );
}
