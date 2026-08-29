// 계획과 실행 결과를 대상 리포의 .autoqa/ 에 남긴다. Git 이 곧 이력이다.
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Plan, RunResult } from "@/lib/runner/types";

const DIR = ".autoqa";
const PLANS = "plans.json";
const VERDICTS = "verdicts.json";
const LATEST = "latest.json";
const RUNS = "runs";

export function autoqaDir(projectDir: string): string {
  return path.join(projectDir, DIR);
}

// 회차마다 바뀌는 산출물은 커밋 대상이 아니다. 판정 결과와 리포트는 남긴다.
const GITIGNORE = `# autoqa 런타임 산출물 — 회차마다 바뀐다
app.log
progress.json
`;

/**
 * .autoqa/ 를 만들면서 .gitignore 도 함께 둔다.
 * 이미 있으면 건드리지 않는다 — 프로젝트가 고쳤을 수 있다.
 */
export async function ensureAutoqaDir(projectDir: string): Promise<string> {
  const dir = autoqaDir(projectDir);
  await mkdir(dir, { recursive: true });
  const ignore = path.join(dir, ".gitignore");
  try {
    await access(ignore);
  } catch {
    await writeFile(ignore, GITIGNORE, "utf8");
  }
  return dir;
}

export async function readPlans(projectDir: string): Promise<Plan[]> {
  try {
    const raw = await readFile(path.join(autoqaDir(projectDir), PLANS), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Plan[]) : [];
  } catch {
    // 첫 실행에는 계획이 없다. 없는 것은 실패가 아니다.
    return [];
  }
}

export async function writePlans(
  projectDir: string,
  plans: Plan[],
): Promise<string> {
  const dir = await ensureAutoqaDir(projectDir);
  const file = path.join(dir, PLANS);
  await writeFile(file, `${JSON.stringify(plans, null, 2)}\n`, "utf8");
  return file;
}

export async function writeRun(
  projectDir: string,
  run: RunResult,
): Promise<string> {
  await ensureAutoqaDir(projectDir);
  // 사람이 찍은 판정은 회차를 넘어 살아 있어야 한다.
  applyHumanVerdicts(run, await readHumanVerdicts(projectDir));
  const dir = path.join(autoqaDir(projectDir), RUNS);
  await mkdir(dir, { recursive: true });
  const stamp = run.startedAt.replace(/[:.]/g, "-");
  const body = `${JSON.stringify(run, null, 2)}\n`;
  const file = path.join(dir, `${stamp}.json`);
  await writeFile(file, body, "utf8");
  await writeFile(path.join(autoqaDir(projectDir), LATEST), body, "utf8");
  return file;
}

/** 대시보드가 읽는다. 아직 한 번도 안 돌렸으면 null. */
export async function readLatestRun(
  projectDir: string,
): Promise<RunResult | null> {
  try {
    const raw = await readFile(
      path.join(autoqaDir(projectDir), LATEST),
      "utf8",
    );
    return JSON.parse(raw) as RunResult;
  } catch {
    return null;
  }
}

/** QA 가 손으로 찍은 판정. 실행과 별개로 남아 회차가 바뀌어도 살아 있다. */
export interface HumanVerdict {
  status: "pass" | "fail" | "skipped";
  reason: string;
  at: string;
}

export async function readHumanVerdicts(
  projectDir: string,
): Promise<Record<string, HumanVerdict>> {
  try {
    const raw = await readFile(
      path.join(autoqaDir(projectDir), VERDICTS),
      "utf8",
    );
    return JSON.parse(raw) as Record<string, HumanVerdict>;
  } catch {
    return {};
  }
}

async function writeHumanVerdicts(
  projectDir: string,
  verdicts: Record<string, HumanVerdict>,
): Promise<void> {
  await ensureAutoqaDir(projectDir);
  await writeFile(
    path.join(autoqaDir(projectDir), VERDICTS),
    `${JSON.stringify(verdicts, null, 2)}\n`,
    "utf8",
  );
}

/**
 * 자동으로 판정하지 못한 TC 에만 사람 판정을 얹는다.
 * 자동 판정은 이번 회차에 실제로 확인한 것이라 사람의 과거 판단보다 우선한다.
 */
export function applyHumanVerdicts(
  run: RunResult,
  verdicts: Record<string, HumanVerdict>,
): RunResult {
  for (const result of run.results) {
    const human = verdicts[result.tcId];
    if (!human) continue;
    if (result.plan.mode !== "manual" && result.plan.mode !== "untriaged") {
      continue;
    }
    result.verdict = {
      status: human.status,
      reason: human.reason,
      by: "human",
      at: human.at,
    };
  }
  run.counts = tally(run);
  return run;
}

function tally(run: RunResult): RunResult["counts"] {
  const counts: RunResult["counts"] = {
    pass: 0,
    fail: 0,
    running: 0,
    pending: 0,
    skipped: 0,
  };
  for (const result of run.results) counts[result.verdict.status] += 1;
  return counts;
}

/**
 * QA 가 화면에서 찍은 판정을 마지막 실행 결과에 덮어쓴다.
 * 자동으로 판정하지 못한 TC 는 사람이 봐야 끝나므로, 그 결과도 같은 파일에 남는다.
 */
export async function saveHumanVerdict(
  projectDir: string,
  tcId: string,
  status: "pass" | "fail" | "skipped",
  note: string,
): Promise<RunResult> {
  const run = await readLatestRun(projectDir);
  if (!run) throw new Error("아직 실행 결과가 없다. 먼저 검증을 한 번 돌려라.");

  const target = run.results.find((result) => result.tcId === tcId);
  if (!target) throw new Error(`${tcId} 는 이번 실행에 없다.`);

  const human: HumanVerdict = {
    status,
    reason: note.trim() || "QA 가 화면에서 직접 판정했다.",
    at: new Date().toISOString(),
  };
  target.verdict = { ...human, by: "human" };
  run.counts = tally(run);

  // 실행 결과와 따로 남긴다. 다음 회차가 latest.json 을 덮어써도 살아남아야 한다.
  const verdicts = await readHumanVerdicts(projectDir);
  verdicts[tcId] = human;
  await writeHumanVerdicts(projectDir, verdicts);

  const body = `${JSON.stringify(run, null, 2)}\n`;
  await writeFile(path.join(autoqaDir(projectDir), LATEST), body, "utf8");
  return run;
}
