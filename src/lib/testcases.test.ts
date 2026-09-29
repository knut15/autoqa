// 리팩토링 전 현재 동작을 고정하는 회귀 테스트.
// summarize() 는 대시보드 카운트·진행률의 유일한 근거다. 상태 5종을 하나라도 세지 못하면
// 화면에 뜨는 통과/실패 수가 실제와 어긋난다.
import test from "node:test";
import assert from "node:assert/strict";

import { summarize, type TcStatus, type TestCase } from "@/lib/testcases";

function tc(status: TcStatus, id = `TC-X-${status}`): TestCase {
  return { id, suite: "s", name: "n", status, durationMs: null };
}

test("summarize: 상태 5종을 각각 정확히 센다 — 하나라도 빠지면 대시보드 숫자가 실제 TC 수와 어긋난다", () => {
  const cases = [
    tc("pass"),
    tc("pass"),
    tc("fail"),
    tc("running"),
    tc("pending"),
    tc("pending"),
    tc("pending"),
    tc("skipped"),
  ];
  const result = summarize(cases);
  assert.deepEqual(result.counts, {
    pass: 2,
    fail: 1,
    running: 1,
    pending: 3,
    skipped: 1,
  });
});

test("summarize: done 은 pass+fail+skipped 만 더한다 — running·pending 은 아직 끝나지 않은 것이라 진행률에 넣으면 안 된다", () => {
  const cases = [
    tc("pass"),
    tc("fail"),
    tc("skipped"),
    tc("running"),
    tc("pending"),
  ];
  const result = summarize(cases);
  assert.equal(result.done, 3);
  assert.equal(result.total, 5);
});

test("summarize: 빈 입력이면 전부 0 — TC 가 하나도 없을 때 화면이 NaN 이나 예외를 내면 안 된다", () => {
  const result = summarize([]);
  assert.deepEqual(result.counts, {
    pass: 0,
    fail: 0,
    running: 0,
    pending: 0,
    skipped: 0,
  });
  assert.equal(result.done, 0);
  assert.equal(result.total, 0);
});
