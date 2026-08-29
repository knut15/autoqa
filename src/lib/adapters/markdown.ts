// 대상 프로젝트의 파일을 읽으므로 Node 런타임 전용이다.
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_COLUMNS,
  type ColumnNames,
  type MarkdownSource,
} from "@/lib/manifest";
import { parseAssert, parseExec } from "@/lib/adapters/exec-spec";
import { tcHash } from "@/lib/runner/hash";
import type { Plan } from "@/lib/runner/types";
import type { Priority, TestCase } from "@/lib/testcases";

/** `## 1. 라우팅·로케일 (RTE)` 에서 제목만 뽑는다. 괄호 안 접두어는 ID 에 이미 들어 있다. */
const SECTION = /^##\s+\d+\.\s+(.+?)\s*(?:\([A-Za-z0-9]+\))?\s*$/;
// 파생 TC 를 허용한다 — 하나를 둘로 쪼갤 때 TC-EXP-09b 처럼 붙이는 것이 흔하다.
const TC_ID = /^TC-[A-Za-z0-9]+-\d+[A-Za-z0-9]*$/;
/** 값이 없는 칸에 쓰는 표기. */
const EMPTY_CELL = new Set(["—", "-", "–", ""]);

const DEFAULT_PRIORITIES = ["P0", "P1", "P2"];

export interface ParseOptions {
  /** 표 헤더의 칸 이름. 문서가 다른 말을 쓰면 매니페스트에서 선언한다. */
  columns?: ColumnNames;
  /** 허용할 우선순위 값. 여기 없는 값이 나오면 읽지 못한 것으로 본다. */
  priorities?: string[];
}

/** 문서가 실행 방법까지 적고 있으면 계획도 함께 나온다. */
export interface MarkdownResult {
  cases: TestCase[];
  /** 실행 칸이 채워진 TC 만. 모델을 부르지 않고 그대로 실행할 수 있다. */
  plans: Plan[];
}

export async function loadMarkdownSource(
  projectDir: string,
  source: MarkdownSource,
  priorities?: string[],
): Promise<MarkdownResult> {
  const file = path.join(projectDir, source.file);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    throw new Error(
      `${file} 을 읽지 못했다. .autoqa.json 의 sources[].file 을 확인해라.`,
    );
  }
  return parseMarkdown(raw, source.file, {
    columns: source.columns,
    priorities,
  });
}

type Field =
  "id" | "priority" | "precondition" | "name" | "expected" | "exec" | "assert";

/** 헤더 칸 이름 → 필드. 절차 칸은 여러 이름을 가질 수 있다. */
function lookup(columns: ColumnNames): Map<string, Field> {
  const map = new Map<string, Field>([
    [columns.id, "id"],
    [columns.priority, "priority"],
    [columns.precondition, "precondition"],
    [columns.expected, "expected"],
    [columns.exec, "exec"],
    [columns.assert, "assert"],
  ]);
  for (const name of columns.name) map.set(name, "name");
  return map;
}

/**
 * TC 표를 담은 마크다운을 TestCase[] 로 바꾼다.
 * 판정 전이므로 status 는 전부 "pending" 이다.
 */
export function parseMarkdown(
  text: string,
  source: string,
  options: ParseOptions = {},
): MarkdownResult {
  const columns = options.columns ?? DEFAULT_COLUMNS;
  const priorities = options.priorities ?? DEFAULT_PRIORITIES;
  const fieldOf = lookup(columns);

  const cases: TestCase[] = [];
  const plans: Plan[] = [];
  const failures: string[] = [];
  const seen = new Set<string>();

  let suite = "";
  let mapping: (Field | null)[] | null = null;

  text.split(/\r?\n/).forEach((line, i) => {
    const lineNo = i + 1;

    const section = SECTION.exec(line);
    if (section) {
      suite = section[1].trim();
      mapping = null;
      return;
    }

    if (!line.startsWith("|")) {
      // 표가 끝나면 다음 표의 헤더를 다시 읽어야 한다.
      if (line.trim() === "") mapping = null;
      return;
    }

    const cells = splitRow(line);
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return;

    if (cells[0] === columns.id) {
      mapping = cells.map((cell) => fieldOf.get(cell) ?? null);
      return;
    }

    if (!cells[0].startsWith("TC-")) return;

    if (!mapping) {
      failures.push(
        `${source}:${lineNo} 표 헤더 없이 TC 행이 나왔다: ${cells[0]}`,
      );
      return;
    }

    const row: Partial<Record<Field, string>> = {};
    mapping.forEach((field, index) => {
      if (field) row[field] = cells[index] ?? "";
    });

    const id = row.id ?? "";
    if (!TC_ID.test(id)) {
      failures.push(`${source}:${lineNo} ID 형식이 아니다: ${id}`);
      return;
    }
    if (seen.has(id)) {
      failures.push(`${source}:${lineNo} ID 가 중복이다: ${id}`);
      return;
    }
    if (!suite) {
      failures.push(`${source}:${lineNo} 어느 절에도 속하지 않는다: ${id}`);
      return;
    }
    const name = clean(row.name);
    if (!name) {
      failures.push(
        `${source}:${lineNo} ${columns.name.join("·")} 칸이 비었다: ${id}`,
      );
      return;
    }
    const priority = row.priority as Priority | undefined;
    if (!priority || !priorities.includes(priority)) {
      failures.push(
        `${source}:${lineNo} ${columns.priority} 칸이 ${priorities.join("/")} 가 아니다: ${id} (받은 값: ${priority ?? "없음"})`,
      );
      return;
    }

    seen.add(id);
    const tc: TestCase = {
      id,
      suite,
      name,
      status: "pending",
      durationMs: null,
      priority,
    };
    const precondition = clean(row.precondition);
    if (precondition) tc.precondition = precondition;
    const expected = clean(row.expected);
    if (expected) tc.expected = expected;
    cases.push(tc);

    // 실행 칸이 비어 있으면 계획이 없는 것이다. 문법이 틀린 것과는 다르다.
    try {
      const spec = parseExec(row.exec ?? "");
      if (spec) {
        const plan: Plan = {
          tcId: id,
          mode: spec.mode,
          reason: spec.reason ?? `문서 ${columns.exec} 칸에 적힌 대로 실행한다`,
          tcHash: tcHash(tc),
        };
        if (spec.command) plan.command = spec.command;
        if (spec.http) plan.http = spec.http;
        if (spec.browser) plan.browser = spec.browser;
        const expect = parseAssert(row.assert ?? "");
        if (Object.keys(expect).length > 0) plan.expect = expect;
        plans.push(plan);
      }
    } catch (error) {
      failures.push(
        `${source}:${lineNo} ${id} — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  // 조용히 흘리면 "137 개 중 130 개만 떴다" 를 아무도 모른다.
  if (failures.length > 0) {
    throw new Error(
      `${source}: TC ${failures.length} 개를 읽지 못했다.\n- ${failures.join("\n- ")}`,
    );
  }
  if (cases.length === 0) {
    throw new Error(
      `${source}: TC 표를 하나도 찾지 못했다. 표 헤더가 "| ${columns.id} | ${columns.priority} | ..." 인지 확인해라.`,
    );
  }
  return { cases, plans };
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  // 이스케이프한 파이프는 셀 구분자가 아니다.
  // 판정식에 `||` 를 쓰려면 문서에서 `\|\|` 로 적는다.
  return trimmed
    .replace(/\\\|/g, "\u0000")
    .split("|")
    .map((cell) => cell.replace(/\u0000/g, "|").trim());
}

function clean(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  return EMPTY_CELL.has(trimmed) ? "" : trimmed;
}
