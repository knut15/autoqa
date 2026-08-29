import type { TcStatus } from "@/lib/testcases";

/**
 * TC 를 무엇으로 실행할지.
 * - manual: 자동화하지 않기로 **정한** 것. 왜인지 reason 에 남는다.
 * - untriaged: 아직 보지 않은 것. 실행 칸이 비어 있다.
 * 둘을 섞으면 "무엇이 남았는지" 를 알 수 없다.
 */
export type PlanMode = "command" | "http" | "browser" | "manual" | "untriaged";

/**
 * 코드가 스스로 판정할 수 있는 조건. 상태 코드가 답할 수 있는 질문은 모델에게 묻지 않는다.
 * 하나라도 어긋나면 fail, 전부 맞으면 pass, 조건이 비어 있으면 모델이 판정한다.
 */
export interface Expect {
  exitCode?: number;
  stdoutEmpty?: boolean;
  stdoutContains?: string;
  stdoutNotContains?: string;
  /** HTTP 응답 상태. 리다이렉트를 볼 때는 307 처럼 원래 코드를 그대로 적는다. */
  status?: number;
  /** 리다이렉트 대상. location 헤더 또는 브라우저 최종 URL 의 경로가 이 값으로 끝나야 한다. */
  redirectsTo?: string;
  bodyContains?: string;
  bodyNotContains?: string;
  /** 브라우저에서만: 페이지 컨텍스트에서 평가해 truthy 여야 한다. */
  evaluate?: string;
}

export type BrowserAction =
  | { action: "goto"; path: string }
  | { action: "click"; selector: string }
  | { action: "fill"; selector: string; value: string }
  | { action: "press"; key: string }
  | { action: "waitFor"; selector: string }
  | { action: "wait"; ms: number }
  | { action: "scroll"; y: number }
  | { action: "back" };

/** TC 하나를 어떻게 실행할지에 대한 확정된 계획. TC 본문이 그대로면 재사용한다. */
export interface Plan {
  tcId: string;
  mode: PlanMode;
  /** 왜 이 모드인지. manual 이면 왜 자동화할 수 없는지. */
  reason: string;
  command?: string;
  http?: {
    path: string;
    method?: string;
    headers?: Record<string, string>;
  };
  browser?: {
    path: string;
    viewport?: { width: number; height: number };
    actions?: BrowserAction[];
  };
  expect?: Expect;
  /** 계획을 만든 시점의 TC 본문 해시. TC 가 바뀌면 계획을 다시 세운다. */
  tcHash: string;
}

/** 실행이 남긴 사실. 판정의 근거가 된다. */
export interface Evidence {
  mode: PlanMode;
  durationMs: number;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  finalUrl?: string;
  evaluated?: unknown;
  /** 실행 자체가 터진 경우. 판정 이전의 실패다. */
  error?: string;
}

export interface Verdict {
  status: TcStatus;
  /** 왜 이렇게 판정했는지. 실패 리포트의 본문이 된다. */
  reason: string;
  /** 누가 판정했는지. human 은 QA 가 화면에서 직접 찍은 것이다. */
  by: "rule" | "model" | "runner" | "human";
  /** QA 가 판정할 때 남긴 시각. */
  at?: string;
}

export interface CaseResult {
  tcId: string;
  suite: string;
  name: string;
  priority?: string;
  expected?: string;
  plan: Plan;
  evidence: Evidence | null;
  verdict: Verdict;
}

export interface RunResult {
  project: string;
  /** 우선순위를 중요한 순으로. 첫 값이 배포 게이트다. */
  priorities: string[];
  startedAt: string;
  finishedAt: string;
  baseUrl: string | null;
  counts: Record<TcStatus, number>;
  results: CaseResult[];
}
