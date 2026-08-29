// 대상 프로젝트에서 명령·요청·브라우저를 실제로 돌린다. Node 런타임 전용이다.
import { exec } from "node:child_process";
import { promisify } from "node:util";

import type { Evidence, Plan } from "@/lib/runner/types";

const run = promisify(exec);

const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const HTTP_TIMEOUT_MS = 30 * 1000;
const BROWSER_TIMEOUT_MS = 60 * 1000;
/** 증거는 판정 근거로만 쓰므로 통째로 들고 있지 않는다. */
const MAX_CAPTURE = 8000;

/**
 * autoqa 자신의 실행 환경이 대상 프로젝트로 새지 않게 걷어낸다.
 * autoqa 를 dev 서버로 띄우면 NODE_ENV=development 가 잡히는데,
 * 그대로 물려주면 대상의 `pnpm build` 가 비표준 NODE_ENV 로 실패한다.
 */
export function cleanEnv(
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  // NODE_ENV 는 타입상 필수라 delete 가 막힌다. 느슨한 맵으로 다룬다.
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.NODE_ENV;
  delete env.PORT;
  delete env.AUTOQA_PROJECT;
  return Object.assign(env, extra) as NodeJS.ProcessEnv;
}

export interface ExecContext {
  /** 대상 리포 절대 경로. */
  dir: string;
  /** 기동된 앱의 주소. 앱을 띄우지 않았으면 null 이고 http·browser 는 실행할 수 없다. */
  baseUrl: string | null;
  /** 매니페스트의 app.env — 명령에도 같은 환경을 준다. */
  env?: Record<string, string>;
}

export async function execute(
  plan: Plan,
  ctx: ExecContext,
): Promise<Evidence | null> {
  // 실행할 것이 없는 두 상태 — 정해서 안 하는 것과 아직 안 본 것.
  if (plan.mode === "manual" || plan.mode === "untriaged") return null;
  const started = Date.now();
  try {
    switch (plan.mode) {
      case "command":
        return await runCommand(plan, ctx, started);
      case "http":
        return await runHttp(plan, ctx, started);
      case "browser":
        return await runBrowser(plan, ctx, started);
    }
  } catch (error) {
    return {
      mode: plan.mode,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runCommand(
  plan: Plan,
  ctx: ExecContext,
  started: number,
): Promise<Evidence> {
  if (!plan.command) throw new Error("command 모드인데 command 가 비었다");
  try {
    const { stdout, stderr } = await run(plan.command, {
      cwd: ctx.dir,
      // 셸 명령도 검증 대상 주소를 알아야 한다.
      // 문서가 포트를 직접 적으면 러너가 띄운 앱이 아닌 곳을 찌르게 된다.
      env: cleanEnv({
        ...ctx.env,
        ...(ctx.baseUrl ? { BASE_URL: ctx.baseUrl } : {}),
      }),
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: 32 * 1024 * 1024,
    });
    return {
      mode: "command",
      durationMs: Date.now() - started,
      exitCode: 0,
      stdout: cut(stdout),
      stderr: cut(stderr),
    };
  } catch (error) {
    // 0 이 아닌 종료는 실행 실패가 아니라 증거다. grep 이 아무것도 못 찾으면 1 로 끝난다.
    const failed = error as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (typeof failed.code !== "number") throw error;
    return {
      mode: "command",
      durationMs: Date.now() - started,
      exitCode: failed.code,
      stdout: cut(failed.stdout ?? ""),
      stderr: cut(failed.stderr ?? ""),
    };
  }
}

async function runHttp(
  plan: Plan,
  ctx: ExecContext,
  started: number,
): Promise<Evidence> {
  if (!plan.http) throw new Error("http 모드인데 http 가 비었다");
  if (!ctx.baseUrl) throw new Error("앱이 기동되지 않아 요청할 주소가 없다");

  const response = await fetch(new URL(plan.http.path, ctx.baseUrl), {
    method: plan.http.method ?? "GET",
    headers: plan.http.headers,
    // 리다이렉트 자체가 검증 대상이라 따라가지 않는다.
    redirect: "manual",
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    mode: "http",
    durationMs: Date.now() - started,
    status: response.status,
    headers,
    body: cut(await response.text()),
  };
}

async function runBrowser(
  plan: Plan,
  ctx: ExecContext,
  started: number,
): Promise<Evidence> {
  if (!plan.browser) throw new Error("browser 모드인데 browser 가 비었다");
  if (!ctx.baseUrl) throw new Error("앱이 기동되지 않아 열 주소가 없다");

  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: plan.browser.viewport ?? { width: 1280, height: 800 },
    });
    page.setDefaultTimeout(BROWSER_TIMEOUT_MS);
    await page.goto(new URL(plan.browser.path, ctx.baseUrl).toString());

    for (const step of plan.browser.actions ?? []) {
      switch (step.action) {
        case "goto":
          await page.goto(new URL(step.path, ctx.baseUrl).toString());
          break;
        case "click":
          await page.click(step.selector);
          break;
        case "fill":
          await page.fill(step.selector, step.value);
          break;
        case "press":
          await page.keyboard.press(step.key);
          break;
        case "waitFor":
          await page.waitForSelector(step.selector);
          break;
        case "wait":
          await page.waitForTimeout(step.ms);
          break;
        case "scroll":
          await page.evaluate((y) => window.scrollTo(0, y), step.y);
          break;
        case "back":
          await page.goBack();
          break;
      }
    }

    const evaluated = plan.expect?.evaluate
      ? await page.evaluate(plan.expect.evaluate)
      : undefined;

    return {
      mode: "browser",
      durationMs: Date.now() - started,
      finalUrl: page.url(),
      body: cut(await page.innerText("body").catch(() => "")),
      evaluated,
    };
  } finally {
    await browser.close();
  }
}

function cut(text: string): string {
  return text.length > MAX_CAPTURE
    ? `${text.slice(0, MAX_CAPTURE)}\n…(${text.length - MAX_CAPTURE}자 생략)`
    : text;
}
