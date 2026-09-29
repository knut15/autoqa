// .autoqa/ 산출물은 대시보드와 QA 의 유일한 기록이다. 여기서 회차를 덮어쓰거나
// 사람이 찍은 판정을 잃으면, 다음 실행 결과를 아무도 신뢰할 수 없다.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  applyHumanVerdicts,
  autoqaDir,
  ensureAutoqaDir,
  readHumanVerdicts,
  readLatestRun,
  readPlans,
  saveHumanVerdict,
  writePlans,
  writeReport,
  writeRun,
  type HumanVerdict,
} from "@/lib/runner/store";
import type { CaseResult, Plan, RunResult } from "@/lib/runner/types";

async function tmp(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "autoqa-store-"));
}

function plan(tcId: string, mode: Plan["mode"] = "command"): Plan {
  return { tcId, mode, reason: "테스트", tcHash: "hash" };
}

function caseResult(
  tcId: string,
  status: CaseResult["verdict"]["status"],
  mode: Plan["mode"] = "command",
): CaseResult {
  return {
    tcId,
    suite: "s",
    name: "n",
    plan: plan(tcId, mode),
    evidence: null,
    verdict: { status, reason: "r", by: "runner" },
  };
}

function run(results: CaseResult[]): RunResult {
  const counts = { pass: 0, fail: 0, running: 0, pending: 0, skipped: 0 };
  for (const result of results) counts[result.verdict.status] += 1;
  return {
    project: "demo",
    priorities: ["P0", "P1"],
    startedAt: "2024-01-01T00:00:00.000Z",
    finishedAt: "2024-01-01T00:01:00.000Z",
    baseUrl: null,
    counts,
    results,
  };
}

test("autoqaDir: 프로젝트 루트 아래 .autoqa 를 가리킨다", () => {
  assert.equal(autoqaDir("/repo"), path.join("/repo", ".autoqa"));
});

test("ensureAutoqaDir: 디렉터리와 .gitignore 를 함께 만든다 — 회차 산출물이 실수로 커밋되면 diff 가 매번 생긴다", async () => {
  const dir = await tmp();
  try {
    await ensureAutoqaDir(dir);
    const gitignore = await readFile(
      path.join(dir, ".autoqa", ".gitignore"),
      "utf8",
    );
    assert.match(gitignore, /app\.log/);
    assert.match(gitignore, /progress\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ensureAutoqaDir: 이미 있는 .gitignore 는 덮어쓰지 않는다 — 대상 프로젝트가 직접 고쳤을 수 있다", async () => {
  const dir = await tmp();
  try {
    await mkdir(path.join(dir, ".autoqa"), { recursive: true });
    await writeFile(
      path.join(dir, ".autoqa", ".gitignore"),
      "custom\n",
      "utf8",
    );
    await ensureAutoqaDir(dir);
    const gitignore = await readFile(
      path.join(dir, ".autoqa", ".gitignore"),
      "utf8",
    );
    assert.equal(gitignore, "custom\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readPlans: .autoqa/plans.json 이 없으면 빈 배열 — 첫 실행에 계획이 없는 것은 실패가 아니다", async () => {
  const dir = await tmp();
  try {
    const plans = await readPlans(dir);
    assert.deepEqual(plans, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writePlans → readPlans: 쓴 계획을 그대로 읽어온다", async () => {
  const dir = await tmp();
  try {
    const plans = [plan("TC-A-1"), plan("TC-A-2", "http")];
    await writePlans(dir, plans);
    const read = await readPlans(dir);
    assert.deepEqual(read, plans);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readLatestRun: 아직 한 번도 안 돌렸으면 null — 대시보드가 첫 화면에서 예외를 내면 안 된다", async () => {
  const dir = await tmp();
  try {
    const latest = await readLatestRun(dir);
    assert.equal(latest, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeRun → readLatestRun: 쓴 실행 결과를 latest.json 에서 그대로 읽어온다", async () => {
  const dir = await tmp();
  try {
    const result = run([
      caseResult("TC-A-1", "pass"),
      caseResult("TC-A-2", "fail"),
    ]);
    await writeRun(dir, result);
    const latest = await readLatestRun(dir);
    assert.equal(latest?.project, "demo");
    assert.equal(latest?.counts.pass, 1);
    assert.equal(latest?.counts.fail, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeRun: startedAt 의 콜론·마침표를 -로 바꾼 파일명으로 runs/ 밑에도 남긴다 — 파일명에 : 이 들어가면 일부 OS 에서 못 만든다", async () => {
  const dir = await tmp();
  try {
    const result = run([caseResult("TC-A-1", "pass")]);
    const file = await writeRun(dir, result);
    assert.equal(
      file,
      path.join(autoqaDir(dir), "runs", "2024-01-01T00-00-00-000Z.json"),
    );
    const raw = await readFile(file, "utf8");
    assert.equal(JSON.parse(raw).project, "demo");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeReport: .autoqa/report.md 에 내용을 그대로 쓰고 그 경로를 돌려준다 — CLI 가 이 경로를 사용자에게 안내한다", async () => {
  const dir = await tmp();
  try {
    const file = await writeReport(dir, "# 리포트\n");
    assert.equal(file, path.join(autoqaDir(dir), "report.md"));
    assert.equal(await readFile(file, "utf8"), "# 리포트\n");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readHumanVerdicts: verdicts.json 이 없으면 빈 객체", async () => {
  const dir = await tmp();
  try {
    const verdicts = await readHumanVerdicts(dir);
    assert.deepEqual(verdicts, {});
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("applyHumanVerdicts: manual·untriaged TC 에만 사람 판정을 얹는다 — 자동으로 이미 판정한 것은 이번 회차 결과가 우선한다", () => {
  const result = run([
    caseResult("TC-A-1", "pending", "manual"),
    caseResult("TC-A-2", "pending", "untriaged"),
    caseResult("TC-A-3", "pass", "command"),
  ]);
  const human: Record<string, HumanVerdict> = {
    "TC-A-1": {
      status: "pass",
      reason: "확인함",
      at: "2024-01-02T00:00:00.000Z",
    },
    "TC-A-2": {
      status: "fail",
      reason: "재현됨",
      at: "2024-01-02T00:00:00.000Z",
    },
    // command 모드로 자동 판정된 TC-A-3 에는 사람 판정이 있어도 적용되면 안 된다.
    "TC-A-3": {
      status: "fail",
      reason: "무시돼야 함",
      at: "2024-01-02T00:00:00.000Z",
    },
  };
  const applied = applyHumanVerdicts(result, human);
  assert.equal(applied.results[0].verdict.status, "pass");
  assert.equal(applied.results[0].verdict.by, "human");
  assert.equal(applied.results[1].verdict.status, "fail");
  assert.equal(applied.results[2].verdict.status, "pass");
  assert.equal(applied.results[2].verdict.by, "runner");
  assert.deepEqual(applied.counts, {
    pass: 2,
    fail: 1,
    running: 0,
    pending: 0,
    skipped: 0,
  });
});

test("writeRun: verdicts.json 에 남아 있던 사람 판정을 새 실행 결과에 자동으로 다시 얹는다", async () => {
  const dir = await tmp();
  try {
    await ensureAutoqaDir(dir);
    await writeFile(
      path.join(autoqaDir(dir), "verdicts.json"),
      JSON.stringify({
        "TC-A-1": {
          status: "pass",
          reason: "지난 회차에 확인함",
          at: "2024-01-02T00:00:00.000Z",
        },
      }),
      "utf8",
    );
    const result = run([caseResult("TC-A-1", "pending", "manual")]);
    await writeRun(dir, result);
    const latest = await readLatestRun(dir);
    assert.equal(latest?.results[0].verdict.status, "pass");
    assert.equal(latest?.results[0].verdict.by, "human");
    assert.equal(latest?.counts.pass, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveHumanVerdict: 실행 결과가 아직 없으면 에러를 던진다", async () => {
  const dir = await tmp();
  try {
    await assert.rejects(
      saveHumanVerdict(dir, "TC-A-1", "pass", "메모"),
      /먼저 검증을 한 번/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveHumanVerdict: 이번 실행에 없는 tcId 면 에러를 던진다", async () => {
  const dir = await tmp();
  try {
    await writeRun(dir, run([caseResult("TC-A-1", "pending", "manual")]));
    await assert.rejects(
      saveHumanVerdict(dir, "TC-NOPE-1", "pass", ""),
      /TC-NOPE-1/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveHumanVerdict: 판정을 저장하면 latest.json 과 verdicts.json 양쪽에 남고, 노트가 비어 있으면 기본 사유가 붙는다", async () => {
  const dir = await tmp();
  try {
    await writeRun(dir, run([caseResult("TC-A-1", "pending", "manual")]));
    const updated = await saveHumanVerdict(dir, "TC-A-1", "fail", "");
    assert.equal(updated.results[0].verdict.status, "fail");
    assert.equal(
      updated.results[0].verdict.reason,
      "QA 가 화면에서 직접 판정했다.",
    );
    assert.equal(updated.counts.fail, 1);

    const persistedVerdicts = await readHumanVerdicts(dir);
    assert.equal(persistedVerdicts["TC-A-1"].status, "fail");

    const latest = await readLatestRun(dir);
    assert.equal(latest?.results[0].verdict.status, "fail");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
