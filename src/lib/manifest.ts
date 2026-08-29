// 대상 프로젝트의 파일을 읽으므로 Node 런타임 전용이다. 클라이언트 컴포넌트에서 import 하지 않는다.
import { readFile } from "node:fs/promises";
import path from "node:path";

/** 표 헤더의 칸 이름. 기본값은 한글이고, 다른 말로 쓴 문서는 여기서 이름을 바꾼다. */
export interface ColumnNames {
  id: string;
  priority: string;
  precondition: string;
  /** 절차 칸. 여러 이름을 허용한다 — 절마다 "절차"·"명령" 처럼 다를 수 있다. */
  name: string[];
  expected: string;
  /** 실행 방법을 적는 칸. 있으면 모델 없이 계획이 나온다. */
  exec: string;
  /** 기계가 검사할 판정 조건을 적는 칸. */
  assert: string;
}

export const DEFAULT_COLUMNS: ColumnNames = {
  id: "ID",
  priority: "P",
  precondition: "사전조건",
  name: ["절차", "명령"],
  expected: "기대 결과",
  exec: "실행",
  assert: "판정",
};

export interface MarkdownSource {
  adapter: "markdown";
  /** 대상 리포 루트 기준 상대 경로. 예: docs/qa/test-cases.md */
  file: string;
  /** 표 헤더가 기본값과 다르면 여기서 선언한다. */
  columns: ColumnNames;
}

export type Source = MarkdownSource;

/** 검증 대상 앱을 어떻게 띄우는지. 없으면 http·browser TC 를 실행할 수 없다. */
export interface AppConfig {
  /** 대상 리포에서 앱을 기동하는 명령. 예: "pnpm dev" */
  start: string;
  /** 기동된 앱의 주소. 예: "http://localhost:3000" */
  baseUrl: string;
  /** 이 시간 안에 baseUrl 이 응답하지 않으면 기동 실패로 본다. 기본 90초. */
  readyTimeoutMs?: number;
  /**
   * 앱에 넘길 환경변수. 외부 공급자를 mock 으로 돌려 공급자 장애와 앱 결함을 가른다.
   * 예: { "USE_MOCK_DATA": "true" }
   */
  env?: Record<string, string>;
  /**
   * 이미 떠 있는 앱을 그대로 쓴다.
   * 기본은 거부다 — 그 앱이 어떤 설정으로 떴는지 알 수 없고,
   * 검증 전제(mock 여부·환경변수)가 어긋나면 결과 전체를 믿을 수 없다.
   */
  reuseRunning?: boolean;
  /**
   * 실행 모드와 무관하게 앱을 항상 띄운다.
   * command TC 가 curl 로 앱을 부르는 경우, 모드만 보고 판단하면 앱이 안 떠서
   * 연결 거부로 조용히 실패한다. 그런 TC 가 있으면 true 로 둔다.
   */
  always?: boolean;
}

/** 대상 프로젝트가 리포 루트에 두는 `.autoqa.json`. */
export interface Manifest {
  /** 대시보드에 뜨는 프로젝트 이름. */
  project: string;
  /** 한 줄 설명. 대시보드 머리말에 쓴다. */
  description?: string;
  /** TC 를 가져올 소스들. 최소 하나. */
  sources: Source[];
  /** 앱 기동 방법. 없으면 command 모드 TC 만 실행된다. */
  app?: AppConfig;
  /**
   * 우선순위 값을 중요한 순으로 적는다. 첫 값이 배포 게이트다.
   * 기본값 ["P0","P1","P2"]. 문서가 Critical/Major/Minor 를 쓰면 그대로 적으면 된다.
   */
  priorities: string[];
}

export const MANIFEST_FILENAME = ".autoqa.json";

const ADAPTERS = ["markdown"] as const;

export async function readManifest(projectDir: string): Promise<Manifest> {
  const file = path.join(projectDir, MANIFEST_FILENAME);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new Error(
      `${file} 을 읽지 못했다. 대상 프로젝트 루트에 ${MANIFEST_FILENAME} 이 있어야 한다.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${file} 이 올바른 JSON 이 아니다: ${String(error)}`);
  }
  return parseManifest(parsed, file);
}

/** 손으로 쓰는 파일이라 어느 필드가 틀렸는지 짚어준다. */
export function parseManifest(value: unknown, source: string): Manifest {
  const raw = requireObject(value, "최상위", source);

  const manifest: Manifest = {
    project: requireString(raw.project, "project", source),
    sources: requireSources(raw.sources, source),
    priorities: parsePriorities(raw.priorities, source),
  };
  if (raw.description !== undefined) {
    manifest.description = requireString(
      raw.description,
      "description",
      source,
    );
  }
  if (raw.app !== undefined) {
    manifest.app = parseApp(raw.app, source);
  }
  return manifest;
}

function parseApp(value: unknown, source: string): AppConfig {
  const raw = requireObject(value, "app", source);
  const app: AppConfig = {
    start: requireString(raw.start, "app.start", source),
    baseUrl: requireString(raw.baseUrl, "app.baseUrl", source),
  };
  if (raw.readyTimeoutMs !== undefined) {
    if (typeof raw.readyTimeoutMs !== "number" || raw.readyTimeoutMs <= 0) {
      throw new Error(`${source}: app.readyTimeoutMs 는 양수여야 한다.`);
    }
    app.readyTimeoutMs = raw.readyTimeoutMs;
  }
  if (raw.reuseRunning !== undefined) {
    if (typeof raw.reuseRunning !== "boolean") {
      throw new Error(
        `${source}: app.reuseRunning 은 true 나 false 여야 한다.`,
      );
    }
    app.reuseRunning = raw.reuseRunning;
  }
  if (raw.always !== undefined) {
    if (typeof raw.always !== "boolean") {
      throw new Error(`${source}: app.always 는 true 나 false 여야 한다.`);
    }
    app.always = raw.always;
  }
  if (raw.env !== undefined) {
    const env = requireObject(raw.env, "app.env", source);
    const pairs: Record<string, string> = {};
    for (const [name, value] of Object.entries(env)) {
      if (typeof value !== "string") {
        throw new Error(`${source}: app.env.${name} 은 문자열이어야 한다.`);
      }
      pairs[name] = value;
    }
    app.env = pairs;
  }
  return app;
}

function requireSources(value: unknown, source: string): Source[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `${source}: sources 는 원소가 하나 이상인 배열이어야 한다.`,
    );
  }
  return value.map((entry, i) => {
    const where = `sources[${i}]`;
    const raw = requireObject(entry, where, source);
    const adapter = requireString(raw.adapter, `${where}.adapter`, source);
    if (!ADAPTERS.includes(adapter as (typeof ADAPTERS)[number])) {
      throw new Error(
        `${source}: ${where}.adapter 는 ${ADAPTERS.join(" | ")} 중 하나여야 한다. 받은 값: ${adapter}`,
      );
    }
    return {
      adapter: "markdown",
      file: requireString(raw.file, `${where}.file`, source),
      columns: parseColumns(raw.columns, `${where}.columns`, source),
    };
  });
}

/** 선언하지 않은 칸은 기본값을 쓴다. 전부 다시 적게 하지 않는다. */
function parseColumns(
  value: unknown,
  where: string,
  source: string,
): ColumnNames {
  if (value === undefined) return DEFAULT_COLUMNS;
  const raw = requireObject(value, where, source);
  return {
    id: optionalString(raw.id, `${where}.id`, source) ?? DEFAULT_COLUMNS.id,
    priority:
      optionalString(raw.priority, `${where}.priority`, source) ??
      DEFAULT_COLUMNS.priority,
    precondition:
      optionalString(raw.precondition, `${where}.precondition`, source) ??
      DEFAULT_COLUMNS.precondition,
    name: parseNames(raw.name, `${where}.name`, source),
    expected:
      optionalString(raw.expected, `${where}.expected`, source) ??
      DEFAULT_COLUMNS.expected,
    exec:
      optionalString(raw.exec, `${where}.exec`, source) ?? DEFAULT_COLUMNS.exec,
    assert:
      optionalString(raw.assert, `${where}.assert`, source) ??
      DEFAULT_COLUMNS.assert,
  };
}

/** 절차 칸은 문자열 하나로 적어도 되고, 절마다 다르면 배열로 적는다. */
function parseNames(value: unknown, where: string, source: string): string[] {
  if (value === undefined) return DEFAULT_COLUMNS.name;
  if (typeof value === "string") return [value];
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "string" && item.trim() !== "")
  ) {
    return value as string[];
  }
  throw new Error(
    `${source}: ${where} 는 문자열이거나 비어 있지 않은 문자열 배열이어야 한다.`,
  );
}

function parsePriorities(value: unknown, source: string): string[] {
  if (value === undefined) return ["P0", "P1", "P2"];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((item) => typeof item === "string" && item.trim() !== "")
  ) {
    throw new Error(
      `${source}: priorities 는 비어 있지 않은 문자열 배열이어야 한다. 중요한 순으로 적는다.`,
    );
  }
  return value as string[];
}

function optionalString(
  value: unknown,
  field: string,
  source: string,
): string | undefined {
  if (value === undefined) return undefined;
  return requireString(value, field, source);
}

function requireObject(
  value: unknown,
  where: string,
  source: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${source}: ${where} 가 객체여야 한다.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string, source: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${source}: ${field} 는 비어 있지 않은 문자열이어야 한다.`);
  }
  return value;
}
