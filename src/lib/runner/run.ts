// 계획 → 실행 → 판정을 한 줄로 잇는다. Node 런타임 전용이다.
import { spawn, type ChildProcess } from "node:child_process";
import { open, readFile } from "node:fs/promises";
import path from "node:path";

import { loadProject } from "@/lib/project";
import type { TcStatus, TestCase } from "@/lib/testcases";
import { cleanEnv, execute } from "@/lib/runner/execute";
import { judgeByModel } from "@/lib/runner/judge-model";
import { judgeByRule, notJudged } from "@/lib/runner/judge";
import { tcHash } from "@/lib/runner/hash";
import { makePlans } from "@/lib/runner/plan";
import { writeProgress, type Progress } from "@/lib/runner/progress";
import {
  autoqaDir,
  ensureAutoqaDir,
  readPlans,
  writePlans,
  writeRun,
} from "@/lib/runner/store";
import type { CaseResult, Plan, RunResult } from "@/lib/runner/types";

const READY_TIMEOUT_MS = 90 * 1000;
const READY_POLL_MS = 500;

export interface RunOptions {
  dir: string;
  /** 이 접두어로 시작하는 TC 만 돌린다. 예: "TC-RTE" */
  only?: string;
  /** 계획만 세우고 실행하지 않는다. */
  planOnly?: boolean;
  /** 진행 상황을 어디에 적을지. CLI 는 stderr 로 넘긴다. */
  log?: (line: string) => void;
}

export async function runAll(options: RunOptions): Promise<RunResult> {
  const log = options.log ?? (() => {});
  const project = await loadProject();
  const cases = options.only
    ? project.cases.filter((tc) => tc.id.startsWith(options.only!))
    : project.cases;

  if (cases.length === 0) {
    throw new Error(
      options.only
        ? `"${options.only}" 로 시작하는 TC 가 없다.`
        : "실행할 TC 가 없다.",
    );
  }

  const startedAt = new Date().toISOString();
  const app = project.manifest.app ?? null;
  const baseUrl = app?.baseUrl ?? null;

  // 화면이 폴링할 수 있게 진행 상태를 파일로 남긴다.
  // 판정이 끝난 TC 를 쌓아 화면이 진행 중에도 도트를 켤 수 있게 한다.
  const done: Record<string, TcStatus> = {};
  const report = async (patch: Partial<Progress>) => {
    await writeProgress(options.dir, {
      startedAt,
      phase: "running",
      current: 0,
      total: cases.length,
      tcId: null,
      message: "",
      done,
      ...patch,
    });
  };
  await report({ phase: "planning", message: "계획을 확인하는 중" });

  const plans = await ensurePlans(
    options.dir,
    cases,
    project.plans,
    baseUrl,
    log,
  );
  const planById = new Map(plans.map((plan) => [plan.tcId, plan]));

  if (options.planOnly) {
    return summarize(
      project.manifest.project,
      project.manifest.priorities,
      startedAt,
      baseUrl,
      cases.map((tc) => planOnlyResult(tc, planById.get(tc.id))),
    );
  }

  // command TC 가 curl 로 앱을 부르는 경우가 있어 모드만으로는 알 수 없다.
  // 그런 프로젝트는 app.always 로 못박는다.
  const needsApp =
    app?.always === true ||
    cases.some((tc) => {
      const mode = planById.get(tc.id)?.mode;
      return mode === "http" || mode === "browser";
    });

  let server: ChildProcess | null = null;
  try {
    if (needsApp) {
      if (!app) {
        log(
          "앱 기동 설정(.autoqa.json 의 app)이 없어 http·browser TC 를 건너뛴다.",
        );
      } else {
        // 남이 띄운 앱으로 검증하면 결과를 믿을 수 없다.
        // 그 앱이 mock 인지 실데이터인지, 어떤 환경변수로 떴는지 알 수 없다.
        if (!app.reuseRunning && (await isServing(app.baseUrl))) {
          throw new Error(
            `${app.baseUrl} 에 이미 무언가 떠 있다. 그 앱이 검증 전제(mock 여부·환경변수)대로 떴는지 알 수 없어 멈춘다. ` +
              `그 서버를 내리고 다시 돌리거나, 그대로 쓰겠다면 .autoqa.json 에 app.reuseRunning: true 를 적어라.`,
          );
        }
        log(`앱 기동: ${app.start}`);
        await report({
          phase: "starting-app",
          message: `앱을 띄우는 중 — ${app.start}${
            app.env ? ` (${Object.keys(app.env).join(", ")})` : ""
          }`,
        });
        server = await startApp(
          options.dir,
          app.start,
          app.baseUrl,
          app.env ?? {},
        );
        await waitForApp(app.baseUrl, app.readyTimeoutMs ?? READY_TIMEOUT_MS);
        log(`앱 준비됨: ${app.baseUrl}`);
      }
    }

    const results: CaseResult[] = [];
    for (const [index, tc] of cases.entries()) {
      const plan = planById.get(tc.id);
      log(
        `[${index + 1}/${cases.length}] ${tc.id} ${plan?.mode ?? "계획없음"}`,
      );
      await report({
        phase: "running",
        current: index + 1,
        tcId: tc.id,
        message: `${tc.id} — ${plan?.mode ?? "자동 실행 대상 아님"}`,
      });
      const result = await runOne(tc, plan, {
        dir: options.dir,
        baseUrl: app ? app.baseUrl : null,
        env: app?.env,
      });
      results.push(result);
      done[tc.id] = result.verdict.status;
      await report({
        phase: "running",
        current: index + 1,
        tcId: tc.id,
        message: `${tc.id} — ${result.verdict.status}`,
      });
    }
    const result = summarize(
      project.manifest.project,
      project.manifest.priorities,
      startedAt,
      baseUrl,
      results,
    );
    await report({
      phase: "done",
      current: cases.length,
      message: `완료 — 통과 ${result.counts.pass} · 실패 ${result.counts.fail} · 판정 불가 ${result.counts.skipped}`,
    });
    return result;
  } catch (error) {
    await report({
      phase: "failed",
      message: "실행이 중단됐다",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    if (server) stopApp(server);
  }
}

/**
 * 실행 칸에서 쓰는 $BASE_URL 을 판정 칸에서도 쓸 수 있어야 한다.
 * 한쪽만 치환하면 "명령은 3001 을 부르는데 판정은 리터럴을 찾는" 어긋남이 난다.
 */
function resolveVars(plan: Plan, baseUrl: string | null): Plan {
  if (!baseUrl || !plan.expect) return plan;
  const sub = (value: string) => value.replaceAll("$BASE_URL", baseUrl);
  const expect = { ...plan.expect };
  for (const key of [
    "stdoutContains",
    "stdoutNotContains",
    "bodyContains",
    "bodyNotContains",
    "redirectsTo",
    "evaluate",
  ] as const) {
    const value = expect[key];
    if (typeof value === "string") expect[key] = sub(value);
  }
  return { ...plan, expect };
}

async function runOne(
  tc: TestCase,
  plan: Plan | undefined,
  ctx: { dir: string; baseUrl: string | null; env?: Record<string, string> },
): Promise<CaseResult> {
  const base = {
    tcId: tc.id,
    suite: tc.suite,
    name: tc.name,
    priority: tc.priority,
    expected: tc.expected,
  };

  if (!plan) {
    return {
      ...base,
      plan: {
        tcId: tc.id,
        mode: "untriaged",
        reason: "실행 칸이 비어 있다",
        tcHash: tcHash(tc),
      },
      evidence: null,
      verdict: notJudged(
        `${tc.id} 의 실행 칸이 비어 있다 — 아직 분류하지 않았다. 자동화할 수 없다면 "manual: 이유" 로 적어라.`,
      ),
    };
  }

  if (plan.mode === "manual") {
    return { ...base, plan, evidence: null, verdict: notJudged(plan.reason) };
  }

  if ((plan.mode === "http" || plan.mode === "browser") && !ctx.baseUrl) {
    return {
      ...base,
      plan,
      evidence: null,
      verdict: notJudged("앱이 기동되지 않아 실행할 수 없다."),
    };
  }

  const resolved = resolveVars(plan, ctx.baseUrl);
  const evidence = await execute(resolved, ctx);
  if (!evidence) {
    return { ...base, plan, evidence: null, verdict: notJudged(plan.reason) };
  }

  const byRule = judgeByRule(resolved, evidence);
  if (byRule) return { ...base, plan, evidence, verdict: byRule };

  try {
    const verdict = await judgeByModel(tc, plan, evidence);
    return { ...base, plan, evidence, verdict };
  } catch (error) {
    return {
      ...base,
      plan,
      evidence,
      verdict: notJudged(
        `판정 조건이 없고 모델 판정도 실패했다: ${error instanceof Error ? error.message : String(error)}`,
      ),
    };
  }
}

function planOnlyResult(tc: TestCase, plan: Plan | undefined): CaseResult {
  const fallback: Plan = {
    tcId: tc.id,
    mode: "untriaged",
    reason: "실행 칸이 비어 있다",
    tcHash: tcHash(tc),
  };
  return {
    tcId: tc.id,
    suite: tc.suite,
    name: tc.name,
    priority: tc.priority,
    expected: tc.expected,
    plan: plan ?? fallback,
    evidence: null,
    verdict: notJudged(
      plan ? "계획만 세웠다 (planOnly)" : "계획을 세우지 못했다.",
    ),
  };
}

/**
 * 계획의 출처는 셋이고 순서가 있다.
 * 1) 문서의 실행 칸 — 사람이 명시한 것이라 가장 권위 있다
 * 2) 캐시된 계획 — TC 본문이 그대로면 재사용한다
 * 3) 모델 — 위 둘로 안 되는 것만
 */
async function ensurePlans(
  dir: string,
  cases: TestCase[],
  fromDoc: Plan[],
  baseUrl: string | null,
  log: (line: string) => void,
): Promise<Plan[]> {
  const cached = await readPlans(dir);
  const byId = new Map(cached.map((plan) => [plan.tcId, plan]));

  const documented = new Set<string>();
  for (const plan of fromDoc) {
    byId.set(plan.tcId, plan);
    documented.add(plan.tcId);
  }
  if (documented.size > 0) {
    log(`문서 실행 칸에서 계획 ${documented.size}건 — 모델 호출 없음`);
  }

  const stale = cases.filter(
    (tc) => !documented.has(tc.id) && byId.get(tc.id)?.tcHash !== tcHash(tc),
  );
  if (stale.length === 0) {
    log(`계획 ${cases.length}건 준비됨 — 모델 호출 없음`);
    return [...byId.values()];
  }

  log(`계획 수립 ${stale.length}건 (재사용 ${cases.length - stale.length}건)`);
  let fresh: Plan[];
  try {
    fresh = await makePlans(stale, { baseUrl, commands: await scripts(dir) });
  } catch (error) {
    // 계획을 못 세운 TC 는 판정 불가로 남기고, 이미 있는 계획(문서·캐시)은 그대로 실행한다.
    log(
      `계획 수립 실패 — ${stale.length}건은 판정 불가로 남는다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [...byId.values()];
  }
  for (const plan of fresh) byId.set(plan.tcId, plan);

  // 문서에서 나온 계획은 매번 문서가 준다. 캐시에는 모델이 만든 것만 남긴다.
  const toCache = [...byId.values()].filter(
    (plan) => !documented.has(plan.tcId),
  );
  const file = await writePlans(dir, toCache);
  log(`계획 저장: ${file}`);
  return [...byId.values()];
}

async function scripts(dir: string): Promise<string[]> {
  try {
    const raw = await readFile(path.join(dir, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
    return Object.keys(parsed.scripts ?? {}).map((name) => `pnpm ${name}`);
  } catch {
    return [];
  }
}

async function startApp(
  dir: string,
  command: string,
  baseUrl: string,
  extraEnv: Record<string, string> = {},
): Promise<ChildProcess> {
  // 앱이 안 뜨면 이유가 남아야 한다. stdio 를 버리면 진단이 불가능하다.
  await ensureAutoqaDir(dir);
  const logFile = path.join(autoqaDir(dir), "app.log");
  const log = await open(logFile, "w");

  // autoqa 자신의 실행 환경을 걷어내고, 대상의 포트는 baseUrl 이 정한다.
  const port = new URL(baseUrl).port;
  const env = cleanEnv({ ...(port ? { PORT: port } : {}), ...extraEnv });

  const child = spawn(command, {
    cwd: dir,
    shell: true,
    env,
    // 자식이 또 자식을 낳으므로(next dev) 그룹째 죽일 수 있게 분리한다.
    detached: true,
    stdio: ["ignore", log.fd, log.fd],
  });
  child.unref();
  // spawn 이 fd 를 복제해 갔으므로 이쪽 핸들은 닫는다. 안 닫으면 GC 경고가 뜬다.
  await log.close();
  return child;
}

function stopApp(server: ChildProcess): void {
  if (server.pid === undefined) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // 이미 죽었으면 그만이다.
  }
}

/** 그 주소에 이미 무언가 응답하는가. */
async function isServing(baseUrl: string): Promise<boolean> {
  try {
    await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

async function waitForApp(baseUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "응답 없음";
  while (Date.now() < deadline) {
    try {
      await fetch(baseUrl, { signal: AbortSignal.timeout(READY_POLL_MS * 4) });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
    }
  }
  throw new Error(
    `${timeoutMs}ms 안에 ${baseUrl} 이 응답하지 않았다. 마지막 오류: ${lastError}. 앱 로그는 .autoqa/app.log 에 있다.`,
  );
}

function summarize(
  project: string,
  priorities: string[],
  startedAt: string,
  baseUrl: string | null,
  results: CaseResult[],
): RunResult {
  const counts: Record<TcStatus, number> = {
    pass: 0,
    fail: 0,
    running: 0,
    pending: 0,
    skipped: 0,
  };
  for (const result of results) counts[result.verdict.status] += 1;
  return {
    project,
    priorities,
    startedAt,
    finishedAt: new Date().toISOString(),
    baseUrl,
    counts,
    results,
  };
}

export { writeRun };
