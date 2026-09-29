// 실행 중 상태를 파일로 남긴다. 화면이 이걸 폴링해 진행을 보여준다.
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Progress } from "@/lib/api-types";
import { autoqaDir, ensureAutoqaDir } from "@/lib/runner/store";

const FILE = "progress.json";

function file(projectDir: string): string {
  return path.join(autoqaDir(projectDir), FILE);
}

export async function writeProgress(
  projectDir: string,
  progress: Progress,
): Promise<void> {
  await ensureAutoqaDir(projectDir);
  await writeFile(file(projectDir), JSON.stringify(progress), "utf8");
}

export async function readProgress(
  projectDir: string,
): Promise<Progress | null> {
  try {
    return JSON.parse(await readFile(file(projectDir), "utf8")) as Progress;
  } catch {
    // 돌고 있지 않으면 파일이 없다. 없는 것은 실패가 아니다.
    return null;
  }
}

export async function clearProgress(projectDir: string): Promise<void> {
  try {
    await unlink(file(projectDir));
  } catch {
    // 이미 없으면 그만이다.
  }
}
