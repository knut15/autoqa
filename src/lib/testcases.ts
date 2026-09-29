export type TcStatus = "pass" | "fail" | "running" | "pending" | "skipped";

/**
 * 수동 TC 의 우선순위. 값은 문서가 정한다 — P0/P1/P2 든 Critical/Major/Minor 든.
 * 중요한 순서는 매니페스트의 priorities 가 정의한다.
 */
export type Priority = string;

export interface TestCase {
  id: string;
  suite: string;
  name: string;
  status: TcStatus;
  durationMs: number | null;
  /** 수동 TC 만 갖는다. */
  priority?: Priority;
  /** 수동 TC 의 사전조건. 없으면 표에 "—" 로 적힌 칸이다. */
  precondition?: string;
  /** 수동 TC 의 기대 결과. 판정 기준이다. */
  expected?: string;
  /** 실행 후에만 붙는다. 왜 그렇게 판정했는지. */
  reason?: string;
  /** 실행 후에만 붙는다. 무엇으로 실행했는지 — command·http·browser·manual. */
  mode?: string;
}

/** TcStatus 5종을 0으로 초기화한 카운터. 러너·스토어·화면이 같은 모양으로 집계하게 한다. */
export function emptyCounts(): Record<TcStatus, number> {
  return {
    pass: 0,
    fail: 0,
    running: 0,
    pending: 0,
    skipped: 0,
  };
}

export function summarize(cases: TestCase[]) {
  const counts = emptyCounts();
  for (const tc of cases) counts[tc.status] += 1;
  return {
    counts,
    done: counts.pass + counts.fail + counts.skipped,
    total: cases.length,
  };
}
