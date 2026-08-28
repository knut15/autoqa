import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_META, StatusDot } from "@/components/qa/status-dot";
import type { TcStatus } from "@/lib/testcases";

export const metadata: Metadata = {
  title: "디자인 시스템 — AutoQA",
};

const STATUS_TOKENS: {
  status: TcStatus;
  token: string;
  light: string;
  dark: string;
  usage: string;
}[] = [
  {
    status: "pass",
    token: "--status-pass",
    light: "#0ca30c",
    dark: "#0ca30c",
    usage: "TC 통과. 채운 원.",
  },
  {
    status: "fail",
    token: "--status-fail",
    light: "#d03b3b",
    dark: "#d03b3b",
    usage: "TC 실패. 다이아몬드 — 모양이 색과 함께 상태를 전달한다.",
  },
  {
    status: "running",
    token: "--status-running",
    light: "#2a78d6",
    dark: "#3987e5",
    usage: "실행 중. 채운 원 + 펄스.",
  },
  {
    status: "skipped",
    token: "--status-skipped",
    light: "#898781",
    dark: "#898781",
    usage: "건너뜀. 회색 원.",
  },
  {
    status: "pending",
    token: "(border 토큰)",
    light: "—",
    dark: "—",
    usage: "대기. 빈 링.",
  },
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-6 md:py-10">
      <div>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          대시보드로 돌아가기
        </Link>
        <h1 className="font-heading text-2xl font-semibold">
          AutoQA 디자인 시스템
        </h1>
        <p className="mt-1 text-muted-foreground">
          shadcn/ui(base-nova) 프리미티브 위에 QA 도메인 토큰과 컴포넌트를 얹은
          것. 페이지는 프리미티브가 아니라 이 문서에 있는 도메인 컴포넌트를
          쓴다.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">규칙</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>
            상태는 <strong>색 + 모양 + 라벨</strong>을 항상 병행한다. green↔red
            는 적록색약(deutan)에서 ΔE 4.1 로 색만으로는 구분되지 않는다
            (validator 측정값).
          </li>
          <li>
            TC ID·수치·시간·환경명은 <span className="font-mono">Geist Mono</span>
            , 나머지 UI 텍스트는 IBM Plex Sans KR 을 쓴다.
          </li>
          <li>
            유채색은 상태 표시에만 쓴다. 크롬(배경·테두리·버튼)은 무채색을
            유지한다.
          </li>
        </ul>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">상태 토큰</h2>
        <div className="space-y-2">
          {STATUS_TOKENS.map((row) => (
            <div
              key={row.status}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <StatusDot status={row.status} />
              <span className="w-14 font-medium">
                {STATUS_META[row.status].label}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {row.token}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                light {row.light} · dark {row.dark}
              </span>
              <span className="basis-full text-xs text-muted-foreground sm:basis-auto">
                {row.usage}
              </span>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">타이포그래피</h2>
        <Card>
          <CardContent className="space-y-2">
            <p className="font-heading text-xl font-semibold">
              화면 제목 — IBM Plex Sans KR 600
            </p>
            <p className="text-sm">본문 — IBM Plex Sans KR 400, 14px</p>
            <p className="text-xs text-muted-foreground">
              캡션 — muted-foreground, 12px
            </p>
            <p className="font-mono text-sm">
              TC-042 · 1.4s · staging — Geist Mono
            </p>
          </CardContent>
        </Card>
      </section>

      <Separator />

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-medium">프리미티브</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button>기본 버튼</Button>
          <Button variant="secondary">보조</Button>
          <Button variant="outline">외곽선</Button>
          <Button variant="ghost">고스트</Button>
          <Button variant="destructive">위험</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>기본</Badge>
          <Badge variant="secondary">보조</Badge>
          <Badge variant="outline">외곽선</Badge>
          <Badge variant="destructive">실패 4</Badge>
        </div>
        <div className="max-w-sm">
          <Input placeholder="ID·스위트·이름으로 검색" />
        </div>
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>카드 제목</CardTitle>
            <CardDescription>카드 설명 — muted-foreground.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
