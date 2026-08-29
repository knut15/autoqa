"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { STATUS_META, StatusDot } from "@/components/qa/status-dot";
import { cn } from "@/lib/utils";
import {
  summarize,
  type Priority,
  type TcStatus,
  type TestCase,
} from "@/lib/testcases";

const LEGEND_ORDER: TcStatus[] = [
  "pass",
  "fail",
  "skipped",
  "running",
  "pending",
];

/** 색 토큰을 새로 만들지 않고 순서로만 구분한다. 값이 P0 든 Critical 든 첫째가 가장 무겁다. */
function priorityStyle(
  priority: Priority | undefined,
  priorities: string[],
): string {
  switch (priorities.indexOf(priority ?? "")) {
    case 0:
      return "font-semibold text-foreground";
    case 1:
      return "text-muted-foreground";
    default:
      return "text-muted-foreground/60";
  }
}

export function RunBoard({
  cases,
  sources,
  priorities,
}: {
  cases: TestCase[];
  sources: string[];
  priorities: string[];
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const rowRefs = React.useRef(new Map<string, HTMLButtonElement>());

  const stats = React.useMemo(() => summarize(cases), [cases]);
  const selected = cases.find((tc) => tc.id === selectedId) ?? null;

  const keyword = query.trim().toLowerCase();
  const filtered = keyword
    ? cases.filter((tc) =>
        `${tc.id} ${tc.suite} ${tc.name} ${tc.priority ?? ""}`
          .toLowerCase()
          .includes(keyword),
      )
    : cases;

  const groups = React.useMemo(() => {
    const acc: { suite: string; items: TestCase[] }[] = [];
    for (const tc of filtered) {
      const last = acc[acc.length - 1];
      if (last && last.suite === tc.suite) last.items.push(tc);
      else acc.push({ suite: tc.suite, items: [tc] });
    }
    return acc;
  }, [filtered]);

  React.useEffect(() => {
    if (!selectedId) return;
    rowRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  function selectFromGrid(id: string) {
    // 검색으로 리스트에서 숨겨진 TC 를 도트로 고르면 검색을 풀어 보여준다
    if (keyword && !filtered.some((tc) => tc.id === id)) setQuery("");
    setSelectedId(id);
  }

  return (
    <div className="flex flex-col items-stretch gap-4 xl:flex-row">
      <Card className="shrink-0 xl:w-96">
        <CardHeader>
          <CardTitle>TC 리스트</CardTitle>
          <CardAction className="font-mono text-xs text-muted-foreground tabular-nums">
            {filtered.length}/{cases.length}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ID·스위트·이름으로 검색"
            aria-label="TC 검색"
          />
          <ScrollArea className="-mx-2 h-[440px]">
            <div className="px-2">
              {groups.map((group) => (
                <div key={group.items[0].id}>
                  <div className="sticky top-0 z-10 bg-card px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground">
                    {group.suite}
                  </div>
                  {group.items.map((tc) => (
                    <button
                      key={tc.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(tc.id, el);
                        else rowRefs.current.delete(tc.id);
                      }}
                      type="button"
                      onClick={() => setSelectedId(tc.id)}
                      aria-pressed={selectedId === tc.id}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50",
                        selectedId === tc.id && "bg-accent",
                      )}
                    >
                      <StatusDot status={tc.status} className="size-2.5" />
                      {tc.priority ? (
                        <span
                          className={cn(
                            "shrink-0 font-mono text-[10px]",
                            priorityStyle(tc.priority, priorities),
                          )}
                        >
                          {tc.priority}
                        </span>
                      ) : null}
                      <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                        {tc.id}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{tc.name}</span>
                      <span className="ml-2 shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                        {tc.durationMs != null
                          ? `${(tc.durationMs / 1000).toFixed(1)}s`
                          : STATUS_META[tc.status].label}
                      </span>
                      <span className="sr-only">
                        {STATUS_META[tc.status].label}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  일치하는 TC 없음 — 다른 검색어를 입력해 보세요.
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="min-w-0 flex-1">
        <CardHeader>
          <CardTitle>실행 현황</CardTitle>
          <CardDescription className="font-mono text-xs break-all">
            {sources.join(" · ")}
          </CardDescription>
          <CardAction className="font-mono text-sm text-muted-foreground tabular-nums">
            완료 {stats.done}/{stats.total}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {LEGEND_ORDER.map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <StatusDot status={status} className="size-2.5" />
                {STATUS_META[status].label}
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {stats.counts[status]}
                </span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {cases.map((tc, index) => (
              <Tooltip key={tc.id}>
                <TooltipTrigger
                  aria-label={`${tc.id} ${tc.name} — ${STATUS_META[tc.status].label}`}
                  onClick={() => selectFromGrid(tc.id)}
                  className={cn(
                    "flex size-5 items-center justify-center rounded-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 motion-safe:animate-in motion-safe:fill-mode-backwards motion-safe:zoom-in-50 motion-safe:fade-in",
                    selectedId === tc.id && "bg-accent ring-2 ring-ring/60",
                  )}
                  style={{ animationDelay: `${Math.min(index * 6, 800)}ms` }}
                >
                  <StatusDot status={tc.status} />
                </TooltipTrigger>
                <TooltipContent>
                  <span className="font-mono">
                    {tc.priority ? `${tc.priority} · ` : ""}
                    {tc.id}
                  </span>
                  <span>
                    {tc.suite} · {tc.name} — {STATUS_META[tc.status].label}
                    {tc.durationMs != null
                      ? ` (${(tc.durationMs / 1000).toFixed(1)}s)`
                      : ""}
                  </span>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          {selected ? (
            <CaseDetail tc={selected} priorities={priorities} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** 판정하려면 절차와 기대 결과가 화면에 있어야 한다. */
function CaseDetail({
  tc,
  priorities,
}: {
  tc: TestCase;
  priorities: string[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusDot status={tc.status} className="size-2.5" />
        <span className="font-mono text-xs">{tc.id}</span>
        {tc.priority ? (
          <span
            className={cn(
              "font-mono text-[11px]",
              priorityStyle(tc.priority, priorities),
            )}
          >
            {tc.priority}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">{tc.suite}</span>
        {tc.mode ? (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {tc.mode}
          </span>
        ) : null}
      </div>
      {tc.reason ? <Field label="판정">{tc.reason}</Field> : null}
      <Field label="절차">{tc.name}</Field>
      {tc.precondition ? (
        <Field label="사전조건">{tc.precondition}</Field>
      ) : null}
      {tc.expected ? <Field label="기대 결과">{tc.expected}</Field> : null}
      <HumanVerdict tcId={tc.id} />
    </div>
  );
}

/**
 * 자동으로 판정하지 못한 TC 는 사람이 봐야 끝난다.
 * QA 가 여기서 찍은 결과도 자동 판정과 같은 파일에 남아 함께 집계된다.
 */
function HumanVerdict({ tcId }: { tcId: string }) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function save(status: "pass" | "fail" | "skipped") {
    setSaving(status);
    setError(null);
    try {
      const response = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tcId, status, note }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "판정을 저장하지 못했다.");
        return;
      }
      setNote("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
        직접 판정
      </span>
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="메모 (선택) — 실패 사유나 확인한 내용"
        aria-label={`${tcId} 판정 메모`}
      />
      {/* 버튼 테두리를 도트와 같은 색으로 둔다 — 무엇을 찍는지 색으로 먼저 읽힌다. */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={saving !== null}
          onClick={() => save("pass")}
          className="border-status-pass/70 text-status-pass hover:border-status-pass hover:bg-status-pass/10 hover:text-status-pass"
        >
          통과
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={saving !== null}
          onClick={() => save("fail")}
          className="border-status-fail/70 text-status-fail hover:border-status-fail hover:bg-status-fail/10 hover:text-status-fail"
        >
          실패
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={saving !== null}
          onClick={() => save("skipped")}
          className="border-status-skipped/70 text-status-skipped hover:border-status-skipped hover:bg-status-skipped/10 hover:text-status-skipped"
        >
          보류
        </Button>
      </div>
      {error ? <p className="text-xs text-status-fail">{error}</p> : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
        {label}
      </span>
      <p className="leading-relaxed break-words">{children}</p>
    </div>
  );
}
