"use client";

import * as React from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  RUN_INFO,
  summarize,
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

export function RunBoard({ cases }: { cases: TestCase[] }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const rowRefs = React.useRef(new Map<string, HTMLButtonElement>());

  const stats = React.useMemo(() => summarize(cases), [cases]);

  const keyword = query.trim().toLowerCase();
  const filtered = keyword
    ? cases.filter((tc) =>
        `${tc.id} ${tc.suite} ${tc.name}`.toLowerCase().includes(keyword)
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
                        selectedId === tc.id && "bg-accent"
                      )}
                    >
                      <StatusDot status={tc.status} className="size-2.5" />
                      <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
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
          <CardDescription className="font-mono text-xs">
            {RUN_INFO.environment} · {RUN_INFO.startedAt} 시작
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
                    "flex size-5 items-center justify-center rounded-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-50 motion-safe:fill-mode-backwards",
                    selectedId === tc.id && "bg-accent ring-2 ring-ring/60"
                  )}
                  style={{ animationDelay: `${Math.min(index * 6, 800)}ms` }}
                >
                  <StatusDot status={tc.status} />
                </TooltipTrigger>
                <TooltipContent>
                  <span className="font-mono">{tc.id}</span>
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
        </CardContent>
      </Card>
    </div>
  );
}
