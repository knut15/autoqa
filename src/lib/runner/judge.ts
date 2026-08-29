import type { Evidence, Expect, Plan, Verdict } from "@/lib/runner/types";

/**
 * 코드가 답할 수 있는 것만 답한다. 조건이 없거나 브라우저 평가처럼 해석이 필요하면
 * null 을 돌려 모델 판정으로 넘긴다.
 */
export function judgeByRule(plan: Plan, evidence: Evidence): Verdict | null {
  if (evidence.error) {
    return {
      status: "fail",
      reason: `실행 자체가 실패했다: ${evidence.error}`,
      by: "runner",
    };
  }

  const expect = plan.expect;
  if (!expect || Object.keys(expect).length === 0) return null;

  const misses: string[] = [];
  const checks: string[] = [];

  check(expect.exitCode !== undefined, () => {
    checks.push(`종료 코드 ${expect.exitCode}`);
    if (evidence.exitCode !== expect.exitCode) {
      misses.push(
        `종료 코드가 ${expect.exitCode} 이어야 하는데 ${evidence.exitCode} 다`,
      );
    }
  });

  check(expect.stdoutEmpty === true, () => {
    checks.push("stdout 비어 있음");
    const out = (evidence.stdout ?? "").trim();
    if (out !== "")
      misses.push(`stdout 이 비어 있어야 하는데 ${out.length}자가 나왔다`);
  });

  check(expect.stdoutContains !== undefined, () => {
    checks.push(`stdout 에 "${expect.stdoutContains}"`);
    if (!(evidence.stdout ?? "").includes(expect.stdoutContains!)) {
      misses.push(`stdout 에 "${expect.stdoutContains}" 가 없다`);
    }
  });

  check(expect.stdoutNotContains !== undefined, () => {
    checks.push(`stdout 에 "${expect.stdoutNotContains}" 없음`);
    if ((evidence.stdout ?? "").includes(expect.stdoutNotContains!)) {
      misses.push(`stdout 에 "${expect.stdoutNotContains}" 가 있으면 안 된다`);
    }
  });

  check(expect.status !== undefined, () => {
    checks.push(`상태 ${expect.status}`);
    if (evidence.status !== expect.status) {
      misses.push(
        `상태가 ${expect.status} 이어야 하는데 ${evidence.status} 다`,
      );
    }
  });

  check(expect.redirectsTo !== undefined, () => {
    checks.push(`이동 위치 ${expect.redirectsTo}`);
    const target = evidence.headers?.location ?? evidence.finalUrl;
    if (!target) {
      misses.push(
        "이동 위치를 확인할 수 없다 (location 헤더도 최종 URL 도 없다)",
      );
    } else if (!pathOf(target).endsWith(expect.redirectsTo!)) {
      misses.push(`"${expect.redirectsTo}" 로 가야 하는데 "${target}" 이다`);
    }
  });

  check(expect.bodyContains !== undefined, () => {
    checks.push(`본문에 "${expect.bodyContains}"`);
    if (!(evidence.body ?? "").includes(expect.bodyContains!)) {
      misses.push(`본문에 "${expect.bodyContains}" 가 없다`);
    }
  });

  check(expect.bodyNotContains !== undefined, () => {
    checks.push(`본문에 "${expect.bodyNotContains}" 없음`);
    if ((evidence.body ?? "").includes(expect.bodyNotContains!)) {
      misses.push(`본문에 "${expect.bodyNotContains}" 가 있으면 안 된다`);
    }
  });

  check(expect.evaluate !== undefined, () => {
    checks.push(`페이지 평가 ${expect.evaluate}`);
    if (!evidence.evaluated) {
      misses.push(
        `페이지 평가 결과가 참이어야 하는데 ${JSON.stringify(evidence.evaluated)} 다`,
      );
    }
  });

  if (checks.length === 0) return null;
  return misses.length > 0
    ? { status: "fail", reason: misses.join(" / "), by: "rule" }
    : { status: "pass", reason: `확인함 — ${checks.join(", ")}`, by: "rule" };

  function check(active: boolean, run: () => void) {
    if (active) run();
  }
}

/** 대상이 절대 URL 이든 "/en" 같은 경로든 경로 부분만 본다. */
function pathOf(target: string): string {
  try {
    return new URL(target).pathname + new URL(target).search;
  } catch {
    return target;
  }
}

/**
 * 자동으로 판정하지 못한 TC. **보류가 아니라 대기다.**
 * 보류(skipped)는 QA 가 직접 "판단을 미룬다" 고 찍은 것이고,
 * 이건 아직 아무도 보지 않은 것이다. 둘을 섞으면 무엇이 남았는지 알 수 없다.
 */
export function notJudged(reason: string): Verdict {
  return { status: "pending", reason, by: "runner" };
}

/** 판정 조건이 얼마나 붙어 있는지. 리포트에서 자동화 수준을 보여준다. */
export function hasRules(expect: Expect | undefined): boolean {
  return !!expect && Object.keys(expect).length > 0;
}
