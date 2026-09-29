// parseMarkdown 은 QA 문서를 TestCase[] 로 바꾸는 유일한 경로다. 형식을 잘못 읽으면
// 문서에 있는 TC 가 조용히 누락되거나, 잘못된 TC 가 실행 대상으로 섞여 들어간다.
import test from "node:test";
import assert from "node:assert/strict";

import { parseMarkdown } from "@/lib/adapters/markdown";
import type { ColumnNames } from "@/lib/manifest";

const TABLE = `## 1. 라우팅 (RTE)

| ID | P | 사전조건 | 절차 | 기대 결과 | 실행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-RTE-01 | P0 | — | 루트 접속 | 200 이 온다 | GET / | status 200 |
| TC-RTE-02 | P1 | 로그인함 | 대시보드 접속 | 대시보드가 보인다 | | |
`;

test("parseMarkdown: 표 두 행을 TestCase 2건으로 읽고, 절 제목의 괄호 접두어는 suite 에서 제외한다", () => {
  const { cases } = parseMarkdown(TABLE, "test.md");
  assert.equal(cases.length, 2);
  assert.equal(cases[0].id, "TC-RTE-01");
  assert.equal(cases[0].suite, "라우팅");
  assert.equal(cases[0].status, "pending");
  assert.equal(cases[0].durationMs, null);
  assert.equal(cases[0].expected, "200 이 온다");
});

test("parseMarkdown: 실행 칸이 채워진 행만 plans 에 들어가고, 빈 행은 계획 없이 TestCase 만 남는다", () => {
  const { cases, plans } = parseMarkdown(TABLE, "test.md");
  assert.equal(cases.length, 2);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].tcId, "TC-RTE-01");
  assert.equal(plans[0].mode, "http");
  assert.deepEqual(plans[0].expect, { status: 200 });
});

test("parseMarkdown: 사전조건 칸의 — 표기는 precondition 을 아예 세팅하지 않는다", () => {
  const { cases } = parseMarkdown(TABLE, "test.md");
  assert.equal(cases[0].precondition, undefined);
  assert.equal(cases[1].precondition, "로그인함");
});

test("parseMarkdown: TC 행이 어느 절에도 속하지 않으면 에러 — 절 제목 없이 표만 있는 문서를 조용히 흘리면 안 된다", () => {
  const noSection = `| ID | P | 사전조건 | 절차 | 기대 결과 | 실행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-A-01 | P0 | — | 절차 | 결과 | | |
`;
  assert.throws(
    () => parseMarkdown(noSection, "test.md"),
    /어느 절에도 속하지 않는다/,
  );
});

test("parseMarkdown: TC- 로는 시작하지만 형식이 아니면 에러 — TC- 로 시작하지 않는 행은 표 밖 텍스트로 보고 조용히 건너뛴다", () => {
  const bad = `## 1. 절 (S)

| ID | P | 사전조건 | 절차 | 기대 결과 | 실행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-1 | P0 | — | 절차 | 결과 | | |
`;
  assert.throws(() => parseMarkdown(bad, "test.md"), /ID 형식이 아니다/);
});

test("parseMarkdown: 같은 ID 가 두 번 나오면 에러", () => {
  const dup = `## 1. 절 (S)

| ID | P | 사전조건 | 절차 | 기대 결과 | 실행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-S-01 | P0 | — | 절차1 | 결과1 | | |
| TC-S-01 | P0 | — | 절차2 | 결과2 | | |
`;
  assert.throws(() => parseMarkdown(dup, "test.md"), /ID 가 중복이다/);
});

test("parseMarkdown: 절차 칸이 비어 있으면 에러", () => {
  const noName = `## 1. 절 (S)

| ID | P | 사전조건 | 절차 | 기대 결과 | 실행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-S-01 | P0 | — | | 결과 | | |
`;
  assert.throws(() => parseMarkdown(noName, "test.md"), /칸이 비었다/);
});

test("parseMarkdown: priorities 에 없는 값이면 에러 — 기본값은 P0/P1/P2 다", () => {
  const badPriority = `## 1. 절 (S)

| ID | P | 사전조건 | 절차 | 기대 결과 | 실행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-S-01 | P9 | — | 절차 | 결과 | | |
`;
  assert.throws(() => parseMarkdown(badPriority, "test.md"), /가 아니다/);
});

test("parseMarkdown: priorities 를 커스텀 값(Critical 등)으로 넘기면 그 값만 허용한다", () => {
  const critical = `## 1. 절 (S)

| ID | P | 사전조건 | 절차 | 기대 결과 | 실행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-S-01 | Critical | — | 절차 | 결과 | | |
`;
  const { cases } = parseMarkdown(critical, "test.md", {
    priorities: ["Critical", "Major"],
  });
  assert.equal(cases[0].priority, "Critical");
});

test("parseMarkdown: TC 표를 하나도 못 찾으면 에러", () => {
  assert.throws(
    () => parseMarkdown("# 표가 없는 문서\n\n그냥 텍스트.\n", "test.md"),
    /TC 표를 하나도 찾지 못했다/,
  );
});

test("parseMarkdown: 헤더 없이 TC 행이 먼저 나오면 에러 — 표가 끝난 뒤 새 표의 헤더를 다시 읽어야 하는 규칙을 검증한다", () => {
  const noHeaderAfterBlank = `## 1. 절 (S)

| ID | P | 사전조건 | 절차 | 기대 결과 | 실행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-S-01 | P0 | — | 절차 | 결과 | | |

| TC-S-02 | P0 | — | 절차 | 결과 | | |
`;
  assert.throws(
    () => parseMarkdown(noHeaderAfterBlank, "test.md"),
    /표 헤더 없이 TC 행이 나왔다/,
  );
});

test("parseMarkdown: 커스텀 칸 이름(columns)을 선언하면 그 이름으로 헤더를 매칭한다", () => {
  const columns: ColumnNames = {
    id: "번호",
    priority: "우선순위",
    precondition: "전제",
    name: ["명령"],
    expected: "예상",
    exec: "실행방법",
    assert: "검증",
  };
  const doc = `## 1. 절 (S)

| 번호 | 우선순위 | 전제 | 명령 | 예상 | 실행방법 | 검증 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-S-01 | P0 | — | 명령 실행 | 성공 | $ pnpm test | exit 0 |
`;
  const { cases, plans } = parseMarkdown(doc, "test.md", { columns });
  assert.equal(cases[0].name, "명령 실행");
  assert.equal(plans[0].mode, "command");
  assert.equal(plans[0].command, "pnpm test");
  assert.deepEqual(plans[0].expect, { exitCode: 0 });
});

test("parseMarkdown: 이스케이프한 파이프(\\|)는 셀 구분자가 아니라 문자 그대로 남는다", () => {
  const doc = `## 1. 절 (S)

| ID | P | 사전조건 | 절차 | 기대 결과 | 실행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-S-01 | P0 | — | A\\|B 확인 | 결과 | | |
`;
  const { cases } = parseMarkdown(doc, "test.md");
  assert.equal(cases[0].name, "A|B 확인");
});

test("parseMarkdown: 실행 칸에 잘못된 문법이 있으면 어떤 TC·줄인지 담아 에러를 낸다", () => {
  const doc = `## 1. 절 (S)

| ID | P | 사전조건 | 절차 | 기대 결과 | 실행 | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| TC-S-01 | P0 | — | 절차 | 결과 | 알수없는형식 | |
`;
  assert.throws(() => parseMarkdown(doc, "test.md"), /TC-S-01/);
});
