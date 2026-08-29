// 표의 "실행"·"판정" 칸에 적은 한 줄을 계획으로 바꾼다.
// 마크다운 표 안이라 `|` 는 쓸 수 없다. 액션은 `>` 로, 판정 조건은 `;` 로 잇는다.
import type { BrowserAction, Expect, Plan } from "@/lib/runner/types";

export type ExecSpec = Pick<Plan, "mode" | "command" | "http" | "browser"> & {
  /** manual 로 정했을 때의 이유. */
  reason?: string;
};

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

/**
 * 실행 칸을 읽는다. 빈 칸이면 null — 자동 실행 대상이 아니라는 뜻이다.
 *
 *   $ pnpm test
 *   GET /
 *   GET / [Accept-Language: ko-KR,ko;q=0.9]
 *   open /en/explore @375x812
 *   open /en/explore > click button.more > wait 500
 */
export function parseExec(raw: string): ExecSpec | null {
  const text = unwrap(raw);
  if (!text) return null;

  // 자동화하지 않기로 정한 것은 이유를 함께 적는다.
  // 빈 칸(아직 안 본 것)과 구분되어야 QA 가 무엇이 남았는지 안다.
  if (text.startsWith("manual")) {
    const reason = text.replace(/^manual\s*:?\s*/, "").trim();
    if (!reason)
      throw new Error("manual 뒤에 이유를 적어라 — 왜 자동화할 수 없는지");
    return { mode: "manual", reason };
  }

  if (text.startsWith("$")) {
    const command = text.slice(1).trim();
    if (!command) throw new Error("`$` 뒤에 명령이 없다");
    return { mode: "command", command };
  }

  if (text.startsWith("open ")) return parseOpen(text.slice(5).trim());

  const method = METHODS.find((m) => text.startsWith(`${m} `));
  if (method) return parseRequest(method, text.slice(method.length).trim());

  throw new Error(
    `실행 칸을 읽지 못했다: "${text}" — "$ 명령", "GET /경로", "open /경로", "manual: 이유" 중 하나여야 한다`,
  );
}

function parseRequest(method: string, rest: string): ExecSpec {
  // 헤더는 대괄호 안에 쉼표로 나열한다. 값 안의 쉼표는 첫 콜론 기준으로 갈라 살린다.
  const headerMatch = /\[([^\]]*)\]\s*$/.exec(rest);
  const path = (headerMatch ? rest.slice(0, headerMatch.index) : rest).trim();
  if (!path.startsWith("/")) {
    throw new Error(`${method} 뒤 경로는 "/" 로 시작해야 한다: "${path}"`);
  }

  const http: NonNullable<ExecSpec["http"]> = { path };
  if (method !== "GET") http.method = method;

  if (headerMatch) {
    const headers: Record<string, string> = {};
    for (const chunk of splitHeaders(headerMatch[1])) {
      const colon = chunk.indexOf(":");
      if (colon < 0) throw new Error(`헤더에 콜론이 없다: "${chunk}"`);
      headers[chunk.slice(0, colon).trim()] = chunk.slice(colon + 1).trim();
    }
    if (Object.keys(headers).length > 0) http.headers = headers;
  }
  return { mode: "http", http };
}

/** 헤더 값에도 쉼표가 들어간다(q=0.9). 이름처럼 보이는 자리에서만 자른다. */
function splitHeaders(text: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const part of text.split(",")) {
    if (current && /^\s*[A-Za-z][A-Za-z0-9-]*\s*:/.test(part)) {
      chunks.push(current.trim());
      current = part;
    } else {
      current = current ? `${current},${part}` : part;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function parseOpen(rest: string): ExecSpec {
  const [head, ...steps] = rest.split(">").map((part) => part.trim());

  const viewportMatch = /@(\d+)x(\d+)\s*$/.exec(head);
  const path = (
    viewportMatch ? head.slice(0, viewportMatch.index) : head
  ).trim();
  if (!path.startsWith("/")) {
    throw new Error(`open 뒤 경로는 "/" 로 시작해야 한다: "${path}"`);
  }

  const browser: NonNullable<ExecSpec["browser"]> = { path };
  if (viewportMatch) {
    browser.viewport = {
      width: Number(viewportMatch[1]),
      height: Number(viewportMatch[2]),
    };
  }
  const actions = steps.filter(Boolean).map(parseAction);
  if (actions.length > 0) browser.actions = actions;
  return { mode: "browser", browser };
}

function parseAction(step: string): BrowserAction {
  if (step.startsWith("click ")) {
    return { action: "click", selector: need(step.slice(6), "click 셀렉터") };
  }
  if (step.startsWith("waitFor ")) {
    return {
      action: "waitFor",
      selector: need(step.slice(8), "waitFor 셀렉터"),
    };
  }
  if (step.startsWith("press ")) {
    return { action: "press", key: need(step.slice(6), "press 키") };
  }
  if (step.startsWith("goto ")) {
    return { action: "goto", path: need(step.slice(5), "goto 경로") };
  }
  if (step.startsWith("wait ")) {
    const ms = Number(step.slice(5).trim());
    if (!Number.isFinite(ms) || ms <= 0) {
      throw new Error(`wait 는 밀리초 숫자여야 한다: "${step}"`);
    }
    return { action: "wait", ms };
  }
  if (step === "back") {
    return { action: "back" };
  }
  if (step.startsWith("scroll ")) {
    const y = Number(step.slice(7).trim());
    if (!Number.isFinite(y) || y < 0) {
      throw new Error(`scroll 은 세로 픽셀 숫자여야 한다: "${step}"`);
    }
    return { action: "scroll", y };
  }
  if (step.startsWith("fill ")) {
    const body = step.slice(5);
    // 셀렉터에도 등호가 있다(input[name=q]). 공백으로 둘러싼 등호만 구분자로 본다.
    const eq = body.lastIndexOf(" = ");
    if (eq < 0)
      throw new Error(
        `fill 은 "fill 셀렉터 = 값" 형식이다 (등호 양쪽에 공백): "${step}"`,
      );
    return {
      action: "fill",
      selector: need(body.slice(0, eq), "fill 셀렉터"),
      value: unquote(body.slice(eq + 3).trim()),
    };
  }
  throw new Error(
    `액션을 읽지 못했다: "${step}" — click·fill·press·waitFor·wait·goto·scroll·back 중 하나여야 한다`,
  );
}

/**
 * 판정 칸을 읽는다. 조건이 하나도 없으면 빈 객체 — 모델 판정으로 넘어간다.
 *
 *   exit 0
 *   status 307 ; -> /en
 *   stdout empty
 *   body has "Nothing matches"
 *   js document.title.length > 0
 */
export function parseAssert(raw: string): Expect {
  const text = unwrap(raw);
  if (!text) return {};

  const expect: Expect = {};
  for (const chunk of text.split(";").map((part) => part.trim())) {
    if (!chunk) continue;
    applyAssert(expect, chunk);
  }
  return expect;
}

function applyAssert(expect: Expect, chunk: string): void {
  // js 표현식에는 세미콜론 말고 무엇이든 들어올 수 있으므로 먼저 본다.
  if (chunk.startsWith("js ")) {
    expect.evaluate = need(chunk.slice(3), "js 표현식");
    return;
  }
  if (chunk.startsWith("->") || chunk.startsWith("→")) {
    const target = chunk.replace(/^(->|→)/, "").trim();
    expect.redirectsTo = need(target, "이동 위치");
    return;
  }
  if (chunk === "stdout empty") {
    expect.stdoutEmpty = true;
    return;
  }

  const numeric = /^(exit|status)\s+(\d+)$/.exec(chunk);
  if (numeric) {
    if (numeric[1] === "exit") expect.exitCode = Number(numeric[2]);
    else expect.status = Number(numeric[2]);
    return;
  }

  const text = /^(stdout|body)\s+(has|lacks)\s+(.+)$/.exec(chunk);
  if (text) {
    const value = unquote(text[3].trim());
    if (!value) throw new Error(`${text[1]} ${text[2]} 뒤에 값이 없다`);
    if (text[1] === "stdout") {
      if (text[2] === "has") expect.stdoutContains = value;
      else expect.stdoutNotContains = value;
    } else {
      if (text[2] === "has") expect.bodyContains = value;
      else expect.bodyNotContains = value;
    }
    return;
  }

  throw new Error(
    `판정 조건을 읽지 못했다: "${chunk}" — exit·status·->·stdout·body·js 중 하나여야 한다`,
  );
}

/** 문서에서 코드로 감싸는 경우가 많다. 백틱과 바깥 공백을 벗긴다. */
function unwrap(raw: string): string {
  const text = (raw ?? "").trim();
  if (text === "" || text === "—" || text === "-" || text === "–") return "";
  return text.replace(/^`+|`+$/g, "").trim();
}

function unquote(text: string): string {
  const trimmed = text.trim();
  return /^(".*"|'.*')$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
}

function need(value: string, what: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${what} 가 비었다`);
  return trimmed;
}
