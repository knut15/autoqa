import type { CaseResult, RunResult } from "@/lib/runner/types";

const STATUS_LABEL: Record<string, string> = {
  pass: "통과",
  fail: "실패",
  skipped: "판정 불가",
  pending: "대기",
  running: "진행 중",
};

/**
 * 실행 결과를 마크다운 리포트로 만든다.
 * 통과 수보다 "무엇이 실패했고 무엇을 판정하지 못했는지" 를 먼저 보여준다.
 */
export function toMarkdown(run: RunResult): string {
  const { counts, results } = run;
  const failed = results.filter((r) => r.verdict.status === "fail");
  // 대기 = 아직 아무도 판정하지 않은 것. 보류 = QA 가 판단을 미룬 것.
  const unjudged = results.filter((r) => r.verdict.status === "pending");
  const held = results.filter((r) => r.verdict.status === "skipped");
  const gate = run.priorities[0];
  const gateFailed = failed.filter((r) => r.priority === gate);

  const lines: string[] = [
    `# QA 실행 리포트 — ${run.project}`,
    "",
    `- 시작: ${run.startedAt}`,
    `- 종료: ${run.finishedAt}`,
    `- 대상: ${run.baseUrl ?? "앱 기동 없음 (명령 TC 만)"}`,
    "",
    "## 판정",
    "",
    gateFailed.length > 0
      ? `**배포 불가 — ${gate} ${gateFailed.length}건 실패.**`
      : failed.length > 0
        ? `**${gate} 는 전부 통과. 그 아래에서 ${failed.length}건 실패.**`
        : unjudged.length > 0
          ? `**실패 없음. 다만 ${unjudged.length}건이 아직 판정되지 않았다.**`
          : "**전 항목 통과.**",
    "",
    "## 요약",
    "",
    "| 상태 | 건수 |",
    "|---|---|",
    `| 통과 | ${counts.pass} |`,
    `| 실패 | ${counts.fail} |`,
    `| 대기 (아직 판정 안 됨) | ${counts.pending} |`,
    `| 보류 (QA 가 판단 미룸) | ${counts.skipped} |`,
    `| 합계 | ${results.length} |`,
    "",
    `자동 판정률: ${rate(counts.pass + counts.fail, results.length)} (${counts.pass + counts.fail}/${results.length})`,
    "",
  ];

  const untriagedCount = results.filter(
    (r) => r.plan.mode === "untriaged" && r.verdict.status === "pending",
  ).length;
  if (untriagedCount > 0) {
    lines.push(
      `아직 분류하지 않은 TC 가 ${untriagedCount}건 있다 — 자동도 수동도 아닌, 검증 밖에 있는 것들이다.`,
      "",
    );
  }

  if (failed.length > 0) {
    lines.push("## 실패", "");
    for (const result of failed) lines.push(...detail(result));
  }

  // "안 하기로 정한 것" 과 "아직 안 본 것" 을 섞으면 무엇이 남았는지 알 수 없다.
  const decided = unjudged.filter((r) => r.plan.mode === "manual");
  const untriaged = unjudged.filter((r) => r.plan.mode === "untriaged");
  const failedToPlan = unjudged.filter(
    (r) => r.plan.mode !== "manual" && r.plan.mode !== "untriaged",
  );

  if (held.length > 0) {
    lines.push(
      "## QA 가 보류한 것",
      "",
      "사람이 보고 판단을 미룬 것들이다. 확인이 끝나면 통과·실패로 바꾼다.",
      "",
      "| ID | P | 절 | 메모 |",
      "|---|---|---|---|",
    );
    for (const r of held) {
      lines.push(
        `| ${r.tcId} | ${r.priority ?? ""} | ${r.suite} | ${cell(r.verdict.reason)} |`,
      );
    }
    lines.push("");
  }

  if (decided.length > 0) {
    lines.push(
      "## 사람이 볼 것 — 자동화하지 않기로 정한 것",
      "",
      "각각 왜 자동화하지 않는지 이유가 붙어 있다. QA 가 손으로 확인한다.",
      "",
      "| ID | P | 절 | 이유 |",
      "|---|---|---|---|",
    );
    for (const r of decided) {
      lines.push(
        `| ${r.tcId} | ${r.priority ?? ""} | ${r.suite} | ${cell(r.plan.reason)} |`,
      );
    }
    lines.push("");
  }

  if (untriaged.length > 0) {
    lines.push(
      "## 아직 분류하지 않은 것",
      "",
      `실행 칸이 비어 있어 자동으로도 수동으로도 잡히지 않았다. **${untriaged.length}건이 검증 밖에 있다.**`,
      "",
      "각 TC 의 `실행` 칸에 실행 방법을 적거나, 자동화할 수 없다면 `manual: 이유` 로 적어라.",
      "",
      "| ID | P | 절 | 절차 |",
      "|---|---|---|---|",
    );
    for (const r of untriaged) {
      lines.push(
        `| ${r.tcId} | ${r.priority ?? ""} | ${r.suite} | ${cell(r.name)} |`,
      );
    }
    lines.push("");
  }

  if (failedToPlan.length > 0) {
    lines.push(
      "## 실행했으나 판정하지 못한 것",
      "",
      "| ID | P | 절 | 이유 |",
      "|---|---|---|---|",
    );
    for (const r of failedToPlan) {
      lines.push(
        `| ${r.tcId} | ${r.priority ?? ""} | ${r.suite} | ${cell(r.verdict.reason)} |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## 실행 방식별",
    "",
    "| 모드 | 통과 | 실패 | 판정 불가 |",
    "|---|---|---|---|",
  );
  for (const mode of [
    "command",
    "http",
    "browser",
    "manual",
    "untriaged",
  ] as const) {
    const rows = results.filter((r) => r.plan.mode === mode);
    if (rows.length === 0) continue;
    lines.push(
      `| ${mode} | ${count(rows, "pass")} | ${count(rows, "fail")} | ${count(rows, "skipped")} |`,
    );
  }
  lines.push("");

  return lines.join("\n");
}

function detail(result: CaseResult): string[] {
  const lines = [
    `### ${result.tcId} ${result.priority ? `(${result.priority})` : ""} — ${result.suite}`,
    "",
    `- 절차: ${result.name}`,
    `- 기대: ${result.expected ?? "—"}`,
    `- 판정: ${result.verdict.reason} _(${result.verdict.by})_`,
  ];
  const evidence = result.evidence;
  if (evidence) {
    if (evidence.exitCode !== undefined)
      lines.push(`- 종료 코드: ${evidence.exitCode}`);
    if (evidence.status !== undefined) lines.push(`- 상태: ${evidence.status}`);
    if (evidence.finalUrl) lines.push(`- 최종 URL: ${evidence.finalUrl}`);
    const output = evidence.stdout || evidence.stderr || evidence.body;
    if (output?.trim()) {
      lines.push("", "```", output.trim().slice(0, 1500), "```");
    }
  }
  lines.push("");
  return lines;
}

/** CLI 가 한 화면에 뿌리는 짧은 요약. */
export function toConsole(run: RunResult): string {
  const { counts, results } = run;
  const failed = results.filter((r) => r.verdict.status === "fail");
  const lines = [
    `${run.project} — ${results.length} TC`,
    // 대기를 빼면 합이 안 맞는다. 무엇이 검증 밖에 있는지가 가장 중요한 수치다.
    `  통과 ${counts.pass} · 실패 ${counts.fail} · 보류 ${counts.skipped} · 대기 ${counts.pending}`,
  ];
  if (failed.length > 0) {
    lines.push("", "실패:");
    for (const result of failed) {
      lines.push(
        `  ${result.priority ?? "  "} ${result.tcId}  ${STATUS_LABEL[result.verdict.status]} — ${result.verdict.reason.slice(0, 100)}`,
      );
    }
  }
  return lines.join("\n");
}

/** 가장 높은 우선순위가 하나라도 실패하면 0 이 아닌 코드로 끝낸다. CI 게이트가 이걸 본다. */
export function exitCode(run: RunResult): number {
  const gate = run.priorities[0];
  return run.results.some(
    (r) => r.verdict.status === "fail" && r.priority === gate,
  )
    ? 1
    : 0;
}

function count(rows: CaseResult[], status: string): number {
  return rows.filter((r) => r.verdict.status === status).length;
}

function rate(part: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)}%`;
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 200);
}
