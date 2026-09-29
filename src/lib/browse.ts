// 폴더를 타고 다니며 리포를 고르게 한다. 브라우저는 로컬 절대 경로를 내주지 않으므로
// (webkitdirectory 도 File System Access API 도 경로 문자열을 주지 않는다) 서버가 대신 읽는다.
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/** 이것이 있으면 리포로 본다. 목록에서 먼저 눈에 띄게 하려는 것뿐이라 느슨해도 된다. */
const REPO_MARKS = [".git", "package.json", ".autoqa.json"];

export interface Entry {
  name: string;
  /** 리포처럼 보이는 폴더. 목록에서 표시해 고르기 쉽게 한다. */
  repo: boolean;
}

export interface Listing {
  ok: boolean;
  error?: string;
  /** 지금 보고 있는 폴더의 절대 경로. */
  dir: string;
  /** 상위 폴더. 루트면 null. */
  parent: string | null;
  entries: Entry[];
}

/** 시작 위치. 입력 칸이 비어 있을 때 홈에서 출발한다. */
export function startDir(): string {
  return homedir();
}

export async function listDir(target: string): Promise<Listing> {
  const dir = path.resolve(target.trim() || startDir());
  const parent = path.dirname(dir);
  const empty: Listing = {
    ok: false,
    dir,
    parent: parent === dir ? null : parent,
    entries: [],
  };

  try {
    if (!(await stat(dir)).isDirectory()) {
      return { ...empty, error: `${dir} 는 디렉터리가 아니다.` };
    }
  } catch {
    return { ...empty, error: `${dir} 를 열 수 없다.` };
  }

  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    // 권한이 없는 폴더가 있다. 목록만 비우고 경로는 살려 둔다 — 상위로 돌아갈 수 있어야 한다.
    return { ...empty, error: `${dir} 를 읽을 권한이 없다.` };
  }

  const entries: Entry[] = [];
  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    // 숨김 폴더는 감춘다. node_modules 는 열어 봐야 리포가 아니고 항목이 수천 개다.
    if (name.startsWith(".") || name === "node_modules") continue;
    const full = path.join(dir, name);
    try {
      if (!(await stat(full)).isDirectory()) continue;
      entries.push({ name, repo: await looksLikeRepo(full) });
    } catch {
      // 심링크가 깨졌거나 읽을 수 없는 항목은 건너뛴다.
    }
  }

  return { ...empty, ok: true, error: undefined, entries };
}

async function looksLikeRepo(dir: string): Promise<boolean> {
  for (const mark of REPO_MARKS) {
    try {
      await stat(path.join(dir, mark));
      return true;
    } catch {
      // 없으면 다음 표시를 본다
    }
  }
  return false;
}
