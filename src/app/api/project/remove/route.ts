// 등록 목록에서 뺀다. 대상 리포의 .autoqa.json 은 건드리지 않는다.
import { NextResponse } from "next/server";

import { readSettings, writeSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { dir } = ((await request.json().catch(() => ({}))) ?? {}) as {
    dir?: string;
  };
  if (!dir) {
    return NextResponse.json({ error: "경로가 없다." }, { status: 400 });
  }

  const settings = readSettings();
  const projects = (settings.projects ?? []).filter((p) => p.dir !== dir);

  // 보고 있던 프로젝트를 지웠으면 남은 것 중 하나로 옮긴다.
  const projectDir =
    settings.projectDir === dir ? projects[0]?.dir : settings.projectDir;

  await writeSettings({ projectDir, projects });
  return NextResponse.json({ projects });
}
