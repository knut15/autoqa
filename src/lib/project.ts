// 대상 프로젝트의 파일을 읽으므로 Node 런타임 전용이다.
import path from "node:path";

import { loadMarkdownSource } from "@/lib/adapters/markdown";
import { readManifest, type Manifest } from "@/lib/manifest";
import { readLatestRun } from "@/lib/runner/store";
import { readSettings } from "@/lib/settings";
import type { Plan, RunResult } from "@/lib/runner/types";
import type { TestCase } from "@/lib/testcases";

export interface Project {
  /** 검증 대상 리포의 절대 경로. */
  dir: string;
  manifest: Manifest;
  cases: TestCase[];
  /** 문서의 실행 칸에서 바로 나온 계획. 모델을 부르지 않고 실행할 수 있다. */
  plans: Plan[];
  /** 마지막 실행 결과. 한 번도 안 돌렸으면 null 이고 모든 TC 가 대기 상태다. */
  run: RunResult | null;
}

/**
 * 검증 대상 리포. 우선순위가 있다.
 * 1) AUTOQA_PROJECT — 개발·CI 에서 명시적으로 가리킬 때
 * 2) 화면에서 등록한 프로젝트 (~/.autoqa/config.json)
 * 3) 현재 디렉터리 — 대상 리포에서 바로 실행한 경우
 */
export function projectDir(): string {
  // 검증 대상은 실행 시점에 정해지므로 경로를 정적으로 좁힐 수 없다. 번들러 경고를 끈다.
  return path.resolve(
    /* turbopackIgnore: true */ process.env.AUTOQA_PROJECT ??
      readSettings().projectDir ??
      process.cwd(),
  );
}

export async function loadProject(): Promise<Project> {
  const dir = projectDir();
  const manifest = await readManifest(dir);

  const cases: TestCase[] = [];
  const plans: Plan[] = [];
  for (const source of manifest.sources) {
    const loaded = await loadMarkdownSource(dir, source, manifest.priorities);
    cases.push(...loaded.cases);
    plans.push(...loaded.plans);
  }

  const run = await readLatestRun(dir);
  return {
    dir,
    manifest,
    cases: run ? merge(cases, run) : cases,
    plans,
    run,
  };
}

/** 문서가 TC 의 원본이고, 실행 결과는 그 위에 얹는다. 문서에 없는 결과는 버린다. */
function merge(cases: TestCase[], run: RunResult): TestCase[] {
  const byId = new Map(run.results.map((result) => [result.tcId, result]));
  return cases.map((tc) => {
    const result = byId.get(tc.id);
    if (!result) return tc;
    return {
      ...tc,
      status: result.verdict.status,
      durationMs: result.evidence?.durationMs ?? null,
      reason: result.verdict.reason,
      mode: result.plan.mode,
    };
  });
}
