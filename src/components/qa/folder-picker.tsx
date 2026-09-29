"use client";

import * as React from "react";
import { ChevronUp, Folder, FolderGit2, FolderOpen, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Listing } from "@/lib/api-types";

/**
 * 폴더를 타고 다니며 리포를 고른다.
 *
 * 브라우저의 폴더 선택은 절대 경로를 주지 않는다 — `webkitdirectory` 는 상대 경로만,
 * File System Access API 는 핸들만 준다. autoqa 는 서버가 같은 기계에서 도는 로컬 도구라
 * 서버가 디렉터리를 읽어 목록을 내려주는 편이 확실하다.
 */
export function FolderPicker({
  value,
  onPick,
}: {
  /** 지금 입력 칸에 있는 경로. 여기서부터 연다. */
  value: string;
  onPick: (dir: string) => void;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [listing, setListing] = React.useState<Listing | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async (dir: string) => {
    setBusy(true);
    try {
      const response = await fetch("/api/project/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir }),
      });
      setListing((await response.json()) as Listing);
    } catch (cause) {
      setListing({
        ok: false,
        dir,
        parent: null,
        entries: [],
        error: cause instanceof Error ? cause.message : String(cause),
      });
    } finally {
      setBusy(false);
    }
  }, []);

  async function open() {
    // 여는 순간 훑는다. 이벤트 안이라 effect 가 아니다.
    await load(value.trim());
    ref.current?.showModal();
  }

  function close() {
    ref.current?.close();
  }

  function choose() {
    if (listing?.dir) onPick(listing.dir);
    close();
  }

  const here = listing?.dir ?? "";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => void open()}
        title="폴더 열기"
      >
        <FolderOpen className="size-4" />
        폴더 열기
      </Button>

      <dialog
        ref={ref}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-xl border bg-card p-0 text-card-foreground backdrop:bg-black/50"
        onClick={(event) => {
          if (event.target === ref.current) close();
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">폴더 열기</p>
            <p className="truncate font-mono text-[11px] text-muted-foreground">
              {here || "…"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="닫기"
            type="button"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="max-h-[22rem] overflow-y-auto px-2 py-2">
          {listing?.parent ? (
            <Row
              icon={<ChevronUp className="size-4 shrink-0" />}
              label="상위 폴더"
              muted
              onClick={() => void load(listing.parent!)}
            />
          ) : null}

          {listing?.error ? (
            <p className="px-3 py-6 text-center text-sm text-status-fail">
              {listing.error}
            </p>
          ) : null}

          {listing?.ok && listing.entries.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              하위 폴더가 없다. 이 폴더를 고르려면 아래 버튼을 누른다.
            </p>
          ) : null}

          {listing?.entries.map((entry) => (
            <Row
              key={entry.name}
              icon={
                entry.repo ? (
                  <FolderGit2 className="size-4 shrink-0 text-foreground" />
                ) : (
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                )
              }
              label={entry.name}
              badge={entry.repo ? "리포" : undefined}
              onClick={() => void load(`${here}/${entry.name}`)}
            />
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" onClick={close} type="button">
            취소
          </Button>
          <Button
            onClick={choose}
            disabled={busy || !listing?.ok}
            type="button"
          >
            이 폴더 선택
          </Button>
        </div>
      </dialog>
    </>
  );
}

function Row({
  icon,
  label,
  badge,
  muted,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px] hover:bg-accent",
        muted && "text-muted-foreground",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
