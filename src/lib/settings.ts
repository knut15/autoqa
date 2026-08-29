// autoqa 자신의 설정. 어느 프로젝트를 보고 있는지를 기억한다.
// 대상 리포가 아니라 사용자 홈에 둔다 — autoqa 는 여러 프로젝트를 오간다.
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** 한 번 등록한 프로젝트. 경로만 두면 사이드바에 무엇인지 안 보인다. */
export interface RegisteredProject {
  dir: string;
  name: string;
}

export interface Settings {
  /** 지금 대시보드가 보고 있는 리포의 절대 경로. */
  projectDir?: string;
  /** 등록해 둔 프로젝트들. 사이드바가 이걸 트리로 보여준다. */
  projects?: RegisteredProject[];
}

export function settingsDir(): string {
  return path.join(os.homedir(), ".autoqa");
}

function settingsFile(): string {
  return path.join(settingsDir(), "config.json");
}

/** 서버 컴포넌트에서도 부르므로 동기로 읽는다. */
export function readSettings(): Settings {
  let settings: Settings;
  try {
    settings = JSON.parse(readFileSync(settingsFile(), "utf8")) as Settings;
  } catch {
    // 아직 등록한 적이 없으면 파일이 없다.
    return {};
  }

  // 목록이 생기기 전에 등록한 프로젝트는 사이드바에서 사라지면 안 된다.
  if (settings.projectDir && !settings.projects?.length) {
    settings.projects = [
      { dir: settings.projectDir, name: path.basename(settings.projectDir) },
    ];
  }
  return settings;
}

/** 등록 목록에 넣고 현재 프로젝트로 잡는다. 같은 경로면 이름만 갱신한다. */
export async function rememberProject(
  dir: string,
  name: string,
): Promise<Settings> {
  const settings = readSettings();
  const projects = (settings.projects ?? []).filter((p) => p.dir !== dir);
  projects.push({ dir, name });
  projects.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const next: Settings = { projectDir: dir, projects };
  await writeSettings(next);
  return next;
}

/** 등록된 것 중 하나로 갈아탄다. 목록에 없는 경로는 받지 않는다. */
export async function switchProject(dir: string): Promise<Settings> {
  const settings = readSettings();
  const known = settings.projects ?? [];
  if (!known.some((p) => p.dir === dir)) {
    throw new Error(`${dir} 는 등록된 프로젝트가 아니다.`);
  }
  const next: Settings = { ...settings, projectDir: dir };
  await writeSettings(next);
  return next;
}

export async function writeSettings(settings: Settings): Promise<void> {
  await mkdir(settingsDir(), { recursive: true });
  await writeFile(
    settingsFile(),
    `${JSON.stringify(settings, null, 2)}\n`,
    "utf8",
  );
}
