// 경로 하나만 받아 나머지를 추정한다. QA 가 JSON 을 손으로 쓰지 않게 하는 것이 목적이다.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/** TC 문서가 있을 만한 곳. 재귀 탐색 대신 흔한 자리만 본다 — 빠르고 예측 가능하다. */
const DOC_DIRS = ["docs/qa", "docs", "qa", "tests/qa", "test/qa", "."];
/** 표 헤더로 볼 만한 첫 칸 이름. 한글·영문 문서를 모두 집는다. */
const TABLE_HEAD = /^\|\s*(ID|아이디)\s*\|/im;

export interface Inspection {
  ok: boolean;
  /** 읽지 못했을 때의 이유. */
  error?: string;
  /** 이미 .autoqa.json 이 있으면 true — 등록이 아니라 수정이다. */
  existing: boolean;
  project: string;
  /** TC 문서 후보. 첫 번째를 기본값으로 제안한다. */
  docs: string[];
  appStart: string;
  appBaseUrl: string;
}

export async function inspectProject(dir: string): Promise<Inspection> {
  const empty: Inspection = {
    ok: false,
    existing: false,
    project: "",
    docs: [],
    appStart: "",
    appBaseUrl: "http://localhost:3000",
  };

  const resolved = path.resolve(dir);
  try {
    const info = await stat(resolved);
    if (!info.isDirectory()) {
      return { ...empty, error: `${resolved} 는 디렉터리가 아니다.` };
    }
  } catch {
    return { ...empty, error: `${resolved} 를 찾을 수 없다.` };
  }

  const pkg = await readJson(path.join(resolved, "package.json"));
  const manifest = await readJson(path.join(resolved, ".autoqa.json"));

  const runner = packageRunner(pkg);
  const hasDev = !!(pkg?.scripts as Record<string, string> | undefined)?.dev;

  return {
    ok: true,
    existing: manifest !== null,
    project:
      (manifest?.project as string) ??
      (pkg?.name as string) ??
      path.basename(resolved),
    docs: await findDocs(resolved, manifest),
    appStart:
      ((manifest?.app as Record<string, string>)?.start ?? hasDev)
        ? `${runner} dev`
        : "",
    appBaseUrl:
      (manifest?.app as Record<string, string>)?.baseUrl ??
      "http://localhost:3000",
  };
}

/** 이미 등록된 문서를 맨 앞에 둔다. QA 가 고르던 것을 다시 고르게 하지 않는다. */
async function findDocs(
  dir: string,
  manifest: Record<string, unknown> | null,
): Promise<string[]> {
  const found: string[] = [];

  const declared = (manifest?.sources as { file?: string }[] | undefined)?.[0]
    ?.file;
  if (declared) found.push(declared);

  for (const sub of DOC_DIRS) {
    let names: string[];
    try {
      names = await readdir(path.join(dir, sub));
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".md")) continue;
      const rel = sub === "." ? name : `${sub}/${name}`;
      if (found.includes(rel)) continue;
      try {
        const body = await readFile(path.join(dir, rel), "utf8");
        if (TABLE_HEAD.test(body)) found.push(rel);
      } catch {
        // 못 읽는 파일은 후보가 아니다.
      }
    }
  }
  return found;
}

function packageRunner(pkg: Record<string, unknown> | null): string {
  const declared = pkg?.packageManager;
  if (typeof declared === "string") {
    if (declared.startsWith("yarn")) return "yarn";
    if (declared.startsWith("npm")) return "npm run";
  }
  return "pnpm";
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}
