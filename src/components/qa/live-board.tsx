"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { RunBoard } from "@/components/qa/run-board";
import { RunControl } from "@/components/qa/run-control";
import type { Progress } from "@/lib/runner/progress";
import type { TestCase } from "@/lib/testcases";

const POLL_MS = 1000;

export function isBusy(progress: Progress | null): boolean {
  return (
    progress !== null &&
    progress.phase !== "done" &&
    progress.phase !== "failed"
  );
}

/**
 * 실행 중에도 결과가 하나씩 보여야 한다.
 * 진행 상태를 한 곳에서 폴링해 버튼과 보드가 같은 것을 본다.
 */
export function LiveBoard({
  cases,
  sources,
  priorities,
}: {
  cases: TestCase[];
  sources: string[];
  priorities: string[];
}) {
  const router = useRouter();
  const [progress, setProgress] = React.useState<Progress | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const wasBusy = React.useRef(false);

  React.useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const response = await fetch("/api/run", { cache: "no-store" });
        const next = (await response.json()) as Progress | null;
        if (!alive) return;
        setProgress(next);

        // 막 끝났으면 서버에서 확정된 결과를 다시 읽는다.
        if (wasBusy.current && !isBusy(next)) router.refresh();
        wasBusy.current = isBusy(next);
      } catch {
        // 폴링 실패는 화면을 망가뜨릴 이유가 못 된다.
      }
    }

    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [router]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/run", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "검증을 시작하지 못했다.");
      } else {
        wasBusy.current = true;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setStarting(false);
    }
  }

  const live = React.useMemo(
    () => (isBusy(progress) ? applyLive(cases, progress!) : cases),
    [cases, progress],
  );

  return (
    <>
      <RunControl
        progress={progress}
        starting={starting}
        error={error}
        onStart={start}
      />
      <RunBoard cases={live} sources={sources} priorities={priorities} />
    </>
  );
}

/**
 * 실행 중에는 이번 회차의 상태만 보여준다.
 * 지난 회차 결과를 그대로 두면 무엇이 이번에 확인된 것인지 알 수 없다.
 */
function applyLive(cases: TestCase[], progress: Progress): TestCase[] {
  return cases.map((tc) => {
    const settled = progress.done?.[tc.id];
    if (settled) return { ...tc, status: settled };
    if (tc.id === progress.tcId) return { ...tc, status: "running" as const };
    return { ...tc, status: "pending" as const, durationMs: null };
  });
}
