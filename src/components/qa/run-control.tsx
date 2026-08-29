"use client";

import { Play, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isBusy } from "@/components/qa/live-board";
import { ProjectSettingsDialog } from "@/components/qa/project-settings-dialog";
import type { Progress } from "@/lib/runner/progress";

const PHASE_LABEL: Record<Progress["phase"], string> = {
  planning: "계획 확인 중",
  "starting-app": "앱 기동 중",
  running: "검증 중",
  done: "완료",
  failed: "중단됨",
};

/** 진행 상태는 LiveBoard 가 한 곳에서 폴링한다. 여기는 보여주고 누르는 일만 한다. */
export function RunControl({
  progress,
  starting,
  error,
  onStart,
}: {
  progress: Progress | null;
  starting: boolean;
  error: string | null;
  onStart: () => void;
}) {
  const busy = isBusy(progress);
  const percent =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {/* 이 프로젝트의 설정. 앱 전체 설정은 사이드바에 따로 있다. */}
        <ProjectSettingsDialog />
        <Button onClick={onStart} disabled={busy || starting}>
          {busy ? (
            <RefreshCw className="size-4 motion-safe:animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          {busy ? "검증 중" : "검증 시작"}
        </Button>

        {progress ? (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {PHASE_LABEL[progress.phase]}
            {progress.total > 0 && progress.phase === "running"
              ? ` · ${progress.current}/${progress.total}`
              : ""}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            아직 검증하지 않았다.
          </span>
        )}
      </div>

      {busy ? (
        <div className="flex flex-col gap-1">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="검증 진행률"
          >
            <div
              className="h-full rounded-full bg-status-running transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {progress?.message}
          </span>
        </div>
      ) : null}

      {progress?.phase === "failed" ? (
        <p className="text-xs text-status-fail">{progress.error}</p>
      ) : null}
      {error ? <p className="text-xs text-status-fail">{error}</p> : null}
    </div>
  );
}
