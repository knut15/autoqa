// judgeByRule 은 코드가 답할 수 있는 것만 답하고, 나머지는 null 로 모델에게 넘긴다.
// 이 경계가 흔들리면 규칙으로 판정 가능한 TC 가 불필요하게 모델을 부르거나,
// 반대로 규칙이 놓친 실패를 pass 로 잘못 확정한다.
import test from "node:test";
import assert from "node:assert/strict";

import { hasRules, judgeByRule, notJudged } from "@/lib/runner/judge";
import type { Evidence, Expect, Plan } from "@/lib/runner/types";

function plan(expect?: Expect): Plan {
  return { tcId: "TC-A-1", mode: "command", reason: "r", tcHash: "h", expect };
}

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return { mode: "command", durationMs: 1, ...overrides };
}

test("judgeByRule: 실행 자체가 실패했으면(evidence.error) 판정 조건과 무관하게 무조건 fail", () => {
  const verdict = judgeByRule(
    plan({ exitCode: 0 }),
    evidence({ error: "명령을 찾을 수 없다" }),
  );
  assert.equal(verdict?.status, "fail");
  assert.match(verdict!.reason, /명령을 찾을 수 없다/);
});

test("judgeByRule: 판정 조건이 없으면 null — 모델 판정으로 넘겨야 하는 신호다", () => {
  assert.equal(judgeByRule(plan(undefined), evidence()), null);
  assert.equal(judgeByRule(plan({}), evidence()), null);
});

test("judgeByRule: exitCode 가 일치하면 pass, 다르면 fail", () => {
  const pass = judgeByRule(plan({ exitCode: 0 }), evidence({ exitCode: 0 }));
  assert.equal(pass?.status, "pass");
  const fail = judgeByRule(plan({ exitCode: 0 }), evidence({ exitCode: 1 }));
  assert.equal(fail?.status, "fail");
  assert.match(fail!.reason, /종료 코드가 0 이어야 하는데 1 다/);
});

test("judgeByRule: stdoutEmpty 는 공백만 있어도 비어 있다고 본다(trim 적용)", () => {
  const pass = judgeByRule(
    plan({ stdoutEmpty: true }),
    evidence({ stdout: "   \n" }),
  );
  assert.equal(pass?.status, "pass");
  const fail = judgeByRule(
    plan({ stdoutEmpty: true }),
    evidence({ stdout: "hi" }),
  );
  assert.equal(fail?.status, "fail");
});

test("judgeByRule: stdoutContains / stdoutNotContains", () => {
  assert.equal(
    judgeByRule(plan({ stdoutContains: "ok" }), evidence({ stdout: "all ok" }))
      ?.status,
    "pass",
  );
  assert.equal(
    judgeByRule(plan({ stdoutContains: "ok" }), evidence({ stdout: "nope" }))
      ?.status,
    "fail",
  );
  assert.equal(
    judgeByRule(
      plan({ stdoutNotContains: "error" }),
      evidence({ stdout: "clean" }),
    )?.status,
    "pass",
  );
  assert.equal(
    judgeByRule(
      plan({ stdoutNotContains: "error" }),
      evidence({ stdout: "error!" }),
    )?.status,
    "fail",
  );
});

test("judgeByRule: HTTP status 비교", () => {
  assert.equal(
    judgeByRule(plan({ status: 200 }), evidence({ status: 200 }))?.status,
    "pass",
  );
  assert.equal(
    judgeByRule(plan({ status: 200 }), evidence({ status: 500 }))?.status,
    "fail",
  );
});

test("judgeByRule: redirectsTo — location 헤더가 있으면 우선 쓰고, 경로 끝이 일치하면 pass", () => {
  const pass = judgeByRule(
    plan({ redirectsTo: "/en" }),
    evidence({ headers: { location: "https://a.com/en" } }),
  );
  assert.equal(pass?.status, "pass");

  const fail = judgeByRule(
    plan({ redirectsTo: "/en" }),
    evidence({ headers: { location: "https://a.com/ko" } }),
  );
  assert.equal(fail?.status, "fail");
});

test("judgeByRule: redirectsTo — location 헤더가 없으면 finalUrl 을 대신 본다", () => {
  const pass = judgeByRule(
    plan({ redirectsTo: "/en" }),
    evidence({ finalUrl: "https://a.com/en" }),
  );
  assert.equal(pass?.status, "pass");
});

test("judgeByRule: redirectsTo — location 도 finalUrl 도 없으면 이동 위치를 확인할 수 없다는 사유로 fail", () => {
  const verdict = judgeByRule(plan({ redirectsTo: "/en" }), evidence());
  assert.equal(verdict?.status, "fail");
  assert.match(verdict!.reason, /이동 위치를 확인할 수 없다/);
});

test("judgeByRule: bodyContains / bodyNotContains", () => {
  assert.equal(
    judgeByRule(
      plan({ bodyContains: "제목" }),
      evidence({ body: "<h1>제목</h1>" }),
    )?.status,
    "pass",
  );
  assert.equal(
    judgeByRule(plan({ bodyNotContains: "에러" }), evidence({ body: "정상" }))
      ?.status,
    "pass",
  );
  assert.equal(
    judgeByRule(
      plan({ bodyNotContains: "에러" }),
      evidence({ body: "에러 발생" }),
    )?.status,
    "fail",
  );
});

test("judgeByRule: evaluate 조건은 evidence.evaluated 가 falsy 면 fail", () => {
  assert.equal(
    judgeByRule(
      plan({ evaluate: "document.title.length > 0" }),
      evidence({ evaluated: false }),
    )?.status,
    "fail",
  );
  assert.equal(
    judgeByRule(
      plan({ evaluate: "document.title.length > 0" }),
      evidence({ evaluated: true }),
    )?.status,
    "pass",
  );
});

test("judgeByRule: 여러 조건이 섞여 있고 하나라도 어긋나면 misses 를 전부 이어붙여 fail", () => {
  const verdict = judgeByRule(
    plan({ exitCode: 0, stdoutContains: "ok" }),
    evidence({ exitCode: 1, stdout: "fail" }),
  );
  assert.equal(verdict?.status, "fail");
  assert.match(verdict!.reason, /종료 코드/);
  assert.match(verdict!.reason, /stdout 에 "ok" 가 없다/);
});

test("notJudged: 항상 pending 상태이고 by 는 runner — pending 은 아직 아무도 보지 않은 것이라 skipped 와 구분돼야 한다", () => {
  const verdict = notJudged("실행 칸이 비어 있다");
  assert.equal(verdict.status, "pending");
  assert.equal(verdict.by, "runner");
  assert.equal(verdict.reason, "실행 칸이 비어 있다");
});

test("hasRules: expect 가 undefined 이거나 빈 객체면 false, 조건이 하나라도 있으면 true", () => {
  assert.equal(hasRules(undefined), false);
  assert.equal(hasRules({}), false);
  assert.equal(hasRules({ exitCode: 0 }), true);
});
