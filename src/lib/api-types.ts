// 화면과 서버가 주고받는 데이터 모양. node: 를 import 하지 않는다 — 클라이언트 컴포넌트가
// 직접 본다. 타입만 여기 있고, 만들고 읽는 함수는 각자의 서버 전용 모듈(browse.ts · inspect.ts ·
// settings.ts · runner/progress.ts)에 남아 있다.
import type { TcStatus } from "@/lib/testcases";

export interface Entry {
  name: string;
  /** 리포처럼 보이는 폴더. 목록에서 표시해 고르기 쉽게 한다. */
  repo: boolean;
}

export interface Listing {
  ok: boolean;
  error?: string;
  /** 지금 보고 있는 폴더의 절대 경로. */
  dir: string;
  /** 상위 폴더. 루트면 null. */
  parent: string | null;
  entries: Entry[];
}

export interface Inspection {
  ok: boolean;
  /** 읽지 못했을 때의 이유. */
  error?: string;
  /** 이미 .autoqa.json 이 있으면 true — 등록이 아니라 수정이다. */
  existing: boolean;
  project: string;
  /** TC 문서 후보. 첫 번째를 기본값으로 제안한다. */
  docs: string[];
  appStart: string;
  appBaseUrl: string;
}

/** 한 번 등록한 프로젝트. 경로만 두면 사이드바에 무엇인지 안 보인다. */
export interface RegisteredProject {
  dir: string;
  name: string;
}

export interface Progress {
  /** 실행을 시작한 시각. 같은 실행인지 구분하는 열쇠다. */
  startedAt: string;
  phase: "planning" | "starting-app" | "running" | "done" | "failed";
  /** 지금 몇 번째를 돌고 있는지. */
  current: number;
  total: number;
  /** 지금 돌고 있는 TC. */
  tcId: string | null;
  /** 마지막 로그 한 줄. 화면에 그대로 띄운다. */
  message: string;
  /** phase 가 failed 일 때의 이유. */
  error?: string;
  /**
   * 지금까지 판정이 끝난 TC 들. 화면이 이걸 읽어 도트를 하나씩 켠다.
   * 실행이 끝날 때까지 기다리지 않고 진행 중에 결과가 보여야 한다.
   */
  done: Record<string, TcStatus>;
}
