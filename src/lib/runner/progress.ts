// 실행 중 상태를 파일로 남긴다. 화면이 이걸 폴링해 진행을 보여준다.
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { autoqaDir, ensureAutoqaDir } from "@/lib/runner/store";
import type { TcStatus } from "@/lib/testcases";

const FILE = "progress.json";

export interface Progress {
  /** 실행을 시작한 시각. 같은 실행인지 구분하는 열쇠다. */
  startedAt: string;
  phase: "planning" | "starting-app" | "running" | "done" | "failed";
  /** 지금 몇 번째를 돌고 있는지. */
  current: number;
  total: number;
  /** 지금 돌고 있는 TC. */
  tcId: string | null;
  /** 마지막 로그 한 줄. 화면에 그대로 띄운다. */
  message: string;
  /** phase 가 failed 일 때의 이유. */
  error?: string;
  /**
   * 지금까지 판정이 끝난 TC 들. 화면이 이걸 읽어 도트를 하나씩 켠다.
   * 실행이 끝날 때까지 기다리지 않고 진행 중에 결과가 보여야 한다.
   */
  done: Record<string, TcStatus>;
}

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
