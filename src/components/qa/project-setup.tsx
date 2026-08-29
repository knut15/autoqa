"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Inspection } from "@/lib/inspect";

interface Props {
  /** 이미 보고 있는 프로젝트가 있으면 그 경로로 시작한다. */
  initialDir?: string;
  /** 서버가 미리 훑어둔 결과. 있으면 폼이 처음부터 채워진 채 뜬다. */
  initial?: Inspection | null;
  /** 등록을 마친 뒤 갈 곳. onDone 이 있으면 무시한다. */
  doneHref?: string;
  /** 모달에서 쓸 때. 이동 대신 닫기만 한다. */
  onDone?: () => void;
  /** 모달 안에서는 카드 테두리가 겹친다. */
  bare?: boolean;
}

/** QA 가 경로 하나만 넣으면 나머지를 채워 .autoqa.json 을 대신 만든다. */
export function ProjectSetup({
  initialDir = "",
  initial = null,
  doneHref = "/",
  onDone,
  bare = false,
}: Props) {
  const router = useRouter();
  const seed = initial?.ok ? initial : null;
  const [dir, setDir] = React.useState(initialDir);
  const [project, setProject] = React.useState(seed?.project ?? "");
  const [file, setFile] = React.useState(seed?.docs[0] ?? "");
  const [docs, setDocs] = React.useState<string[]>(seed?.docs ?? []);
  const [appStart, setAppStart] = React.useState(seed?.appStart ?? "");
  const [appBaseUrl, setAppBaseUrl] = React.useState(seed?.appBaseUrl ?? "");
  const [looking, setLooking] = React.useState(false);
  const [found, setFound] = React.useState<Inspection | null>(seed);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const look = React.useCallback(async (target: string) => {
    if (!target.trim()) return;
    setLooking(true);
    setError(null);
    try {
      const response = await fetch("/api/project/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir: target }),
      });
      const result = (await response.json()) as Inspection;
      setFound(result);
      if (!result.ok) {
        setError(result.error ?? "프로젝트를 읽지 못했다.");
        return;
      }
      setProject(result.project);
      setDocs(result.docs);
      setFile(result.docs[0] ?? "");
      setAppStart(result.appStart);
      setAppBaseUrl(result.appBaseUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLooking(false);
    }
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir, project, file, appStart, appBaseUrl }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "등록하지 못했다.");
        return;
      }
      if (onDone) onDone();
      else router.push(doneHref);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  const inner = (
    <>
      {/* 모달로 열 때는 모달 헤더가 제목을 맡는다 — 두 번 쓰지 않는다. */}
      {bare ? null : (
        <CardHeader>
          <CardTitle>검증할 프로젝트 등록</CardTitle>
          <CardDescription>
            리포 경로만 넣으면 나머지는 찾아서 채운다. 저장하면 그 리포에{" "}
            <code className="font-mono">.autoqa.json</code> 을 만든다.
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className="flex flex-col gap-5">
        <Field
          label="프로젝트 경로"
          hint="검증할 리포의 절대 경로. 예: /Users/me/work/my-app"
        >
          <div className="flex gap-2">
            <Input
              value={dir}
              onChange={(event) => setDir(event.target.value)}
              onBlur={() => void look(dir)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void look(dir);
              }}
              placeholder="/path/to/repo"
              aria-label="프로젝트 경로"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void look(dir)}
              disabled={looking || !dir.trim()}
            >
              <FolderSearch className="size-4" />
              {looking ? "찾는 중" : "찾기"}
            </Button>
          </div>
        </Field>

        {found?.ok ? (
          <>
            {found.existing ? (
              <p className="text-xs text-muted-foreground">
                이미 <code className="font-mono">.autoqa.json</code> 이 있다.
                기존 설정은 그대로 두고 아래 값만 바꾼다.
              </p>
            ) : null}

            <Field label="프로젝트 이름" hint="대시보드 머리말에 뜬다.">
              <Input
                value={project}
                onChange={(event) => setProject(event.target.value)}
                aria-label="프로젝트 이름"
              />
            </Field>

            <Field
              label="TC 문서"
              hint={
                docs.length > 0
                  ? "표가 들어 있는 마크다운을 찾았다. 다른 파일이면 직접 고쳐도 된다."
                  : "표가 있는 마크다운을 못 찾았다. 경로를 직접 적어라."
              }
            >
              <Input
                value={file}
                onChange={(event) => setFile(event.target.value)}
                placeholder="docs/qa/test-cases.md"
                aria-label="TC 문서 경로"
              />
              {docs.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {docs.map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => setFile(candidate)}
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono text-[11px] hover:bg-muted",
                        file === candidate && "bg-accent",
                      )}
                    >
                      {candidate}
                    </button>
                  ))}
                </div>
              ) : null}
            </Field>

            <Field
              label="앱 기동 (선택)"
              hint="비워두면 명령으로 끝나는 TC 만 자동 실행된다. 화면·요청을 검증하려면 필요하다."
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={appStart}
                  onChange={(event) => setAppStart(event.target.value)}
                  placeholder="pnpm dev"
                  aria-label="앱 기동 명령"
                />
                <Input
                  value={appBaseUrl}
                  onChange={(event) => setAppBaseUrl(event.target.value)}
                  placeholder="http://localhost:3000"
                  aria-label="앱 주소"
                />
              </div>
            </Field>

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={saving}>
                {saving ? "저장 중" : bare ? "저장" : "등록하고 시작"}
              </Button>
              <span className="font-mono text-[11px] text-muted-foreground">
                {dir}/.autoqa.json
              </span>
            </div>
          </>
        ) : null}

        {error ? <p className="text-sm text-status-fail">{error}</p> : null}
      </CardContent>
    </>
  );

  // 모달 안에서는 카드 테두리가 겹쳐 보인다.
  if (bare) return inner;
  return <Card className="max-w-3xl">{inner}</Card>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
      {children}
    </div>
  );
}
