// .autoqa.json 은 사람이 손으로 쓰는 파일이다. parseManifest 가 어느 필드를 어떻게
// 거부하는지가 바뀌면 사용자가 보는 에러 메시지와 허용 범위가 조용히 바뀐다.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  DEFAULT_COLUMNS,
  MANIFEST_FILENAME,
  parseManifest,
  readManifest,
  readRawManifest,
  writeManifest,
} from "@/lib/manifest";

test("MANIFEST_FILENAME 은 .autoqa.json 이다 — 대상 프로젝트가 찾는 파일명이 바뀌면 안내 문구와 어긋난다", () => {
  assert.equal(MANIFEST_FILENAME, ".autoqa.json");
});

test("parseManifest: 최소 필드(project, sources)만으로도 통과하고 priorities 는 기본값 P0/P1/P2 를 쓴다", () => {
  const manifest = parseManifest(
    {
      project: "demo",
      sources: [{ adapter: "markdown", file: "docs/qa.md" }],
    },
    "test",
  );
  assert.equal(manifest.project, "demo");
  assert.deepEqual(manifest.priorities, ["P0", "P1", "P2"]);
  assert.equal(manifest.sources.length, 1);
  assert.deepEqual(manifest.sources[0].columns, DEFAULT_COLUMNS);
});

test("parseManifest: sources 를 선언하지 않은 칸 이름은 DEFAULT_COLUMNS 로 채운다 — 문서마다 매번 전체를 다시 적게 하면 안 된다", () => {
  const manifest = parseManifest(
    {
      project: "demo",
      sources: [
        {
          adapter: "markdown",
          file: "docs/qa.md",
          columns: { id: "번호" },
        },
      ],
    },
    "test",
  );
  assert.equal(manifest.sources[0].columns.id, "번호");
  assert.equal(manifest.sources[0].columns.priority, DEFAULT_COLUMNS.priority);
  assert.deepEqual(manifest.sources[0].columns.name, DEFAULT_COLUMNS.name);
});

test("parseManifest: project 가 없으면 거부한다 — 대시보드 제목이 빈 채로 뜨는 것을 막는다", () => {
  assert.throws(
    () =>
      parseManifest(
        { sources: [{ adapter: "markdown", file: "a.md" }] },
        "test",
      ),
    /project/,
  );
});

test("parseManifest: sources 가 빈 배열이면 거부한다 — TC 출처가 하나도 없으면 아무것도 못 돌린다", () => {
  assert.throws(
    () => parseManifest({ project: "demo", sources: [] }, "test"),
    /sources/,
  );
});

test("parseManifest: sources[].adapter 가 markdown 이 아니면 거부한다 — 아직 markdown 어댑터만 지원한다", () => {
  assert.throws(
    () =>
      parseManifest(
        { project: "demo", sources: [{ adapter: "csv", file: "a.md" }] },
        "test",
      ),
    /adapter/,
  );
});

test("parseManifest: priorities 를 커스텀 값(Critical/Major/Minor)으로 적으면 그대로 쓴다", () => {
  const manifest = parseManifest(
    {
      project: "demo",
      sources: [{ adapter: "markdown", file: "a.md" }],
      priorities: ["Critical", "Major", "Minor"],
    },
    "test",
  );
  assert.deepEqual(manifest.priorities, ["Critical", "Major", "Minor"]);
});

test("parseManifest: app.readyTimeoutMs 가 0 이하면 거부한다 — 타임아웃 0은 즉시 실패를 의미해 기동 자체가 불가능해진다", () => {
  assert.throws(
    () =>
      parseManifest(
        {
          project: "demo",
          sources: [{ adapter: "markdown", file: "a.md" }],
          app: {
            start: "pnpm dev",
            baseUrl: "http://localhost:3000",
            readyTimeoutMs: 0,
          },
        },
        "test",
      ),
    /readyTimeoutMs/,
  );
});

test("parseManifest: app.env 의 값이 문자열이 아니면 거부한다 — 자식 프로세스 환경변수는 전부 문자열이어야 한다", () => {
  assert.throws(
    () =>
      parseManifest(
        {
          project: "demo",
          sources: [{ adapter: "markdown", file: "a.md" }],
          app: {
            start: "pnpm dev",
            baseUrl: "http://localhost:3000",
            env: { PORT: 3000 },
          },
        },
        "test",
      ),
    /app\.env\.PORT/,
  );
});

test("parseManifest: 최상위가 객체가 아니면 거부한다 — 배열이나 문자열을 .autoqa.json 에 적었을 때도 위치를 짚어줘야 한다", () => {
  assert.throws(() => parseManifest([], "test"), /최상위/);
});

test("readManifest: .autoqa.json 이 없으면 파일 경로를 담은 에러를 낸다", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "autoqa-manifest-"));
  try {
    await assert.rejects(readManifest(dir), /\.autoqa\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readManifest: 올바른 JSON 이 아니면 어느 파일이 문제인지 담은 에러를 낸다", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "autoqa-manifest-"));
  try {
    await writeFile(path.join(dir, MANIFEST_FILENAME), "{ not json", "utf8");
    await assert.rejects(readManifest(dir), /올바른 JSON/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readManifest: 유효한 .autoqa.json 을 실제로 읽어 project 를 돌려준다", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "autoqa-manifest-"));
  try {
    await writeFile(
      path.join(dir, MANIFEST_FILENAME),
      JSON.stringify({
        project: "회귀테스트",
        sources: [{ adapter: "markdown", file: "docs/qa.md" }],
      }),
      "utf8",
    );
    const manifest = await readManifest(dir);
    assert.equal(manifest.project, "회귀테스트");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readRawManifest: .autoqa.json 이 없으면 null 을 돌려준다 — 등록 화면이 새 프로젝트를 병합할 때 던지면 안 된다", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "autoqa-manifest-"));
  try {
    assert.equal(await readRawManifest(dir), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readRawManifest: 올바른 JSON 이 아니면 검증하지 않고 null 을 돌려준다", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "autoqa-manifest-"));
  try {
    await writeFile(path.join(dir, MANIFEST_FILENAME), "{ not json", "utf8");
    assert.equal(await readRawManifest(dir), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readRawManifest: 필수 필드가 빠져도 검증 없이 원문 그대로 돌려준다", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "autoqa-manifest-"));
  try {
    await writeFile(
      path.join(dir, MANIFEST_FILENAME),
      JSON.stringify({ columns: { id: "번호" } }),
      "utf8",
    );
    const raw = await readRawManifest(dir);
    assert.deepEqual(raw, { columns: { id: "번호" } });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeManifest: 들여쓰기 2칸과 끝 줄바꿈을 붙여 .autoqa.json 에 쓰고 그 경로를 돌려준다", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "autoqa-manifest-"));
  try {
    const file = await writeManifest(dir, { project: "demo" });
    assert.equal(file, path.join(dir, MANIFEST_FILENAME));
    const written = await readFile(file, "utf8");
    assert.equal(written, `${JSON.stringify({ project: "demo" }, null, 2)}\n`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
