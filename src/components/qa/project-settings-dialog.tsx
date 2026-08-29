"use client";

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectSetup } from "@/components/qa/project-setup";
import type { Inspection } from "@/lib/inspect";

/**
 * 이 프로젝트의 설정을 모달로 연다.
 * 네이티브 <dialog> 라 Esc·backdrop·포커스 가둠이 기본으로 온다.
 */
export function ProjectSettingsDialog() {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [initial, setInitial] = React.useState<Inspection | null>(null);
  const [dir, setDir] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function open() {
    setLoading(true);
    try {
      // 열 때 현재 프로젝트를 훑어 폼을 채운다. 이벤트 안이라 effect 가 아니다.
      const response = await fetch("/api/project", { cache: "no-store" });
      const found = (await response.json()) as Inspection & { dir?: string };
      setInitial(found);
      setDir(found.dir ?? "");
    } catch {
      setInitial(null);
    } finally {
      setLoading(false);
      ref.current?.showModal();
    }
  }

  function close() {
    ref.current?.close();
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={open}
        disabled={loading}
        title="프로젝트 설정"
        aria-label="프로젝트 설정"
      >
        <SlidersHorizontal className="size-4" />
      </Button>

      <dialog
        ref={ref}
        // backdrop 은 dialog 의 ::backdrop 의사요소라 여기서 색을 준다
        className="m-auto w-[min(48rem,calc(100vw-2rem))] rounded-xl border bg-card p-0 text-card-foreground backdrop:bg-black/50"
        onClick={(event) => {
          // 바깥(backdrop)을 누르면 닫는다 — 안쪽 클릭은 target 이 자식이다
          if (event.target === ref.current) close();
        }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <span className="font-heading font-semibold">프로젝트 설정</span>
          <Button variant="ghost" size="icon" onClick={close} aria-label="닫기">
            <X className="size-4" />
          </Button>
        </div>
        {/* CardContent 는 px-(--card-spacing) 을 쓴다. Card 밖이라 여기서 변수를 준다. */}
        <div className="max-h-[70vh] overflow-y-auto py-(--card-spacing) [--card-spacing:--spacing(6)]">
          {/* 훑은 결과가 온 뒤에 마운트한다 — 폼의 초기값은 첫 렌더에만 잡힌다. */}
          {initial ? (
            <ProjectSetup
              key={dir}
              bare
              initialDir={dir}
              initial={initial}
              onDone={close}
            />
          ) : (
            <p className="px-6 py-8 text-sm text-muted-foreground">
              프로젝트를 읽는 중…
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
