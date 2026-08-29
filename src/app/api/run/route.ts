// 화면의 "검증 시작" 버튼이 부른다. 실행은 오래 걸리므로 시작만 하고 바로 응답한다.
import { NextResponse } from "next/server";

import { projectDir } from "@/lib/project";
import { clearProgress, readProgress } from "@/lib/runner/progress";
import { runAll, writeRun } from "@/lib/runner/run";
import { toMarkdown } from "@/lib/runner/report";
import { autoqaDir } from "@/lib/runner/store";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/** 진행 상태를 화면이 폴링한다. */
export async function GET() {
  return NextResponse.json(await readProgress(projectDir()));
}

/** 실행을 시작한다. 이미 돌고 있으면 거절한다 — 앱을 두 번 띄우면 포트가 충돌한다. */
export async function POST() {
  const dir = projectDir();

  const current = await readProgress(dir);
  if (current && current.phase !== "done" && current.phase !== "failed") {
    return NextResponse.json(
      { error: "이미 실행 중이다.", progress: current },
      { status: 409 },
    );
  }

  await clearProgress(dir);

  // 응답을 기다리게 하지 않는다. 화면은 GET 으로 진행을 따라간다.
  void runAll({ dir, log: () => {} })
    .then(async (run) => {
      await writeRun(dir, run);
      await writeFile(
        path.join(autoqaDir(dir), "report.md"),
        toMarkdown(run),
        "utf8",
      );
    })
    .catch(() => {
      // 실패는 progress 의 phase 로 이미 남았다.
    });

  return NextResponse.json({ started: true });
}
