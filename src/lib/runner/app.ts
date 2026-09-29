// 대상 앱의 수명 관리 — 기동 · 준비 대기 · 종료. Node 런타임 전용이다.
import { spawn, type ChildProcess } from "node:child_process";
import { open, readFile } from "node:fs/promises";
import path from "node:path";

import { cleanEnv } from "@/lib/runner/execute";
import { autoqaDir, ensureAutoqaDir } from "@/lib/runner/store";

const READY_POLL_MS = 500;

export async function scripts(dir: string): Promise<string[]> {
  try {
    const raw = await readFile(path.join(dir, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
    return Object.keys(parsed.scripts ?? {}).map((name) => `pnpm ${name}`);
  } catch {
    return [];
  }
}

export async function startApp(
  dir: string,
  command: string,
  baseUrl: string,
  extraEnv: Record<string, string> = {},
): Promise<ChildProcess> {
  // 앱이 안 뜨면 이유가 남아야 한다. stdio 를 버리면 진단이 불가능하다.
  await ensureAutoqaDir(dir);
  const logFile = path.join(autoqaDir(dir), "app.log");
  const log = await open(logFile, "w");

  // autoqa 자신의 실행 환경을 걷어내고, 대상의 포트는 baseUrl 이 정한다.
  const port = new URL(baseUrl).port;
  const env = cleanEnv({ ...(port ? { PORT: port } : {}), ...extraEnv });

  const child = spawn(command, {
    cwd: dir,
    shell: true,
    env,
    // 자식이 또 자식을 낳으므로(next dev) 그룹째 죽일 수 있게 분리한다.
    detached: true,
    stdio: ["ignore", log.fd, log.fd],
  });
  child.unref();
  // spawn 이 fd 를 복제해 갔으므로 이쪽 핸들은 닫는다. 안 닫으면 GC 경고가 뜬다.
  await log.close();
  return child;
}

export function stopApp(server: ChildProcess): void {
  if (server.pid === undefined) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // 이미 죽었으면 그만이다.
  }
}

/** 그 주소에 이미 무언가 응답하는가. */
export async function isServing(baseUrl: string): Promise<boolean> {
  try {
    await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

export async function waitForApp(
  baseUrl: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "응답 없음";
  while (Date.now() < deadline) {
    try {
      await fetch(baseUrl, { signal: AbortSignal.timeout(READY_POLL_MS * 4) });
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
    }
  }
  throw new Error(
    `${timeoutMs}ms 안에 ${baseUrl} 이 응답하지 않았다. 마지막 오류: ${lastError}. 앱 로그는 .autoqa/app.log 에 있다.`,
  );
}
