// inspectProject 는 QA 가 .autoqa.json 을 손으로 안 써도 되게 추정해 주는 진입점이다.
// 등록 여부(existing)와 문서 후보(docs) 판단이 틀리면 이미 등록된 프로젝트를 새 프로젝트로
// 잘못 안내하거나, TC 문서를 못 찾아 등록 자체가 막힌다.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { inspectProject } from "@/lib/inspect";

async function tmp(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "autoqa-inspect-"));
}

test("inspectProject: 존재하지 않는 디렉터리는 ok:false 와 경로를 담은 에러를 낸다", async () => {
  const dir = await tmp();
  await rm(dir, { recursive: true, force: true });
  const result = await inspectProject(dir);
  assert.equal(result.ok, false);
  assert.match(result.error ?? "", /찾을 수 없다/);
});

test("inspectProject: 디렉터리가 아니라 파일 경로를 주면 ok:false 다", async () => {
  const dir = await tmp();
  try {
    const file = path.join(dir, "not-a-dir");
    await writeFile(file, "x", "utf8");
    const result = await inspectProject(file);
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /디렉터리가 아니다/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inspectProject: package.json·.autoqa.json 이 둘 다 없으면 existing:false, project 는 폴더 이름으로 떨어진다", async () => {
  const dir = await tmp();
  try {
    const result = await inspectProject(dir);
    assert.equal(result.ok, true);
    assert.equal(result.existing, false);
    assert.equal(result.project, path.basename(dir));
    assert.equal(result.appBaseUrl, "http://localhost:3000");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inspectProject: .autoqa.json 이 이미 있으면 existing:true 이고 project·baseUrl 을 매니페스트에서 가져온다", async () => {
  const dir = await tmp();
  try {
    await writeFile(
      path.join(dir, ".autoqa.json"),
      JSON.stringify({
        project: "기존 프로젝트",
        sources: [{ adapter: "markdown", file: "docs/qa.md" }],
        app: { start: "pnpm dev", baseUrl: "http://localhost:4000" },
      }),
      "utf8",
    );
    const result = await inspectProject(dir);
    assert.equal(result.existing, true);
    assert.equal(result.project, "기존 프로젝트");
    assert.equal(result.appBaseUrl, "http://localhost:4000");
    // 현재 구현은 app.start 값 자체가 아니라 "<runner> dev" 로 고정해 돌려준다.
    // 리팩토링 전 실제 동작을 그대로 고정한다 — 값이 바뀌면 이 테스트가 알려준다.
    assert.equal(result.appStart, "pnpm dev");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inspectProject: package.json 만 있고 scripts.dev 가 있으면 project 는 package.json name, appStart 는 pnpm dev", async () => {
  const dir = await tmp();
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "패키지이름", scripts: { dev: "next dev" } }),
      "utf8",
    );
    const result = await inspectProject(dir);
    assert.equal(result.existing, false);
    assert.equal(result.project, "패키지이름");
    assert.equal(result.appStart, "pnpm dev");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inspectProject: package.json 에 scripts.dev 가 없으면 appStart 는 빈 문자열이다", async () => {
  const dir = await tmp();
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "패키지이름", scripts: {} }),
      "utf8",
    );
    const result = await inspectProject(dir);
    assert.equal(result.appStart, "");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inspectProject: packageManager 가 yarn 이면 appStart 러너도 yarn 으로 바뀐다", async () => {
  const dir = await tmp();
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "p",
        packageManager: "yarn@4.0.0",
        scripts: { dev: "next dev" },
      }),
      "utf8",
    );
    const result = await inspectProject(dir);
    assert.equal(result.appStart, "yarn dev");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inspectProject: 매니페스트의 sources[0].file 은 존재 여부와 무관하게 docs 후보 맨 앞에 온다", async () => {
  const dir = await tmp();
  try {
    await writeFile(
      path.join(dir, ".autoqa.json"),
      JSON.stringify({
        project: "p",
        sources: [{ adapter: "markdown", file: "spec/tc.md" }],
      }),
      "utf8",
    );
    const result = await inspectProject(dir);
    assert.equal(result.docs[0], "spec/tc.md");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("inspectProject: docs/qa 아래 표 헤더(| ID | ...)가 있는 .md 만 문서 후보로 찾고, 헤더 없는 .md 는 뺀다", async () => {
  const dir = await tmp();
  try {
    await mkdir(path.join(dir, "docs", "qa"), { recursive: true });
    await writeFile(
      path.join(dir, "docs", "qa", "cases.md"),
      "# TC\n\n| ID | 사전조건 |\n| --- | --- |\n",
      "utf8",
    );
    await writeFile(
      path.join(dir, "docs", "qa", "notes.md"),
      "# 그냥 메모, 표 아님\n",
      "utf8",
    );
    const result = await inspectProject(dir);
    assert.deepEqual(result.docs, ["docs/qa/cases.md"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
