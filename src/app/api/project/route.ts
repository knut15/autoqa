// 프로젝트 등록·전환. QA 가 .autoqa.json 을 손으로 쓰지 않게 대신 만든다.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { inspectProject } from "@/lib/inspect";
import { MANIFEST_FILENAME } from "@/lib/manifest";
import { projectDir } from "@/lib/project";
import { rememberProject } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const dir = projectDir();
  return NextResponse.json({ dir, ...(await inspectProject(dir)) });
}

export async function POST(request: Request) {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as {
    dir?: string;
    project?: string;
    file?: string;
    appStart?: string;
    appBaseUrl?: string;
  };

  const dir = (body.dir ?? "").trim();
  const project = (body.project ?? "").trim();
  const file = (body.file ?? "").trim();
  if (!dir) return bad("프로젝트 경로를 입력해라.");
  if (!project) return bad("프로젝트 이름을 입력해라.");
  if (!file) return bad("TC 문서 경로를 입력해라.");

  const found = await inspectProject(dir);
  if (!found.ok) return bad(found.error ?? "프로젝트를 읽지 못했다.");

  const resolved = path.resolve(dir);
  const manifestPath = path.join(resolved, MANIFEST_FILENAME);

  // 손으로 적은 columns·priorities 를 등록 화면이 지우면 안 된다. 있는 값 위에 얹는다.
  const existing = await readJson(manifestPath);
  const sources = Array.isArray(existing?.sources) ? [...existing.sources] : [];
  const first = (sources[0] ?? { adapter: "markdown" }) as Record<
    string,
    unknown
  >;
  sources[0] = { ...first, adapter: "markdown", file };

  const manifest: Record<string, unknown> = {
    ...(existing ?? {}),
    project,
    sources,
  };

  const start = (body.appStart ?? "").trim();
  const baseUrl = (body.appBaseUrl ?? "").trim();
  if (start && baseUrl) {
    const app = (existing?.app ?? {}) as Record<string, unknown>;
    manifest.app = { ...app, start, baseUrl };
  } else {
    delete manifest.app;
  }

  // TC 문서가 실제로 읽히는지 여기서 확인한다. 등록해놓고 화면에서 터지면 안 된다.
  try {
    await readFile(path.join(resolved, file), "utf8");
  } catch {
    return bad(`${file} 을 읽지 못했다. 경로를 확인해라.`);
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await rememberProject(resolved, project);

  return NextResponse.json({ dir: resolved, manifest: manifestPath });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

async function readJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}
