import Link from "next/link";
import { BarChart3, LayoutDashboard, Settings } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProjectTree } from "@/components/qa/project-tree";
import { readSettings } from "@/lib/settings";

export function AppSidebar() {
  const settings = readSettings();
  const projects = settings.projects ?? [];

  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
        <span className="flex items-center gap-1" aria-hidden>
          <span className="size-2 rounded-full bg-status-pass" />
          <span className="size-2 rotate-45 rounded-[1.5px] bg-status-fail" />
        </span>
        <span className="font-heading leading-none font-semibold">AutoQA</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        <div className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
          메뉴
        </div>
        <Link
          href="/"
          aria-current="page"
          className="flex items-center gap-2.5 rounded-md bg-sidebar-accent px-2 py-1.5 text-sm font-medium text-sidebar-accent-foreground"
        >
          <LayoutDashboard className="size-4" />
          대시보드
        </Link>
        <ProjectTree projects={projects} current={settings.projectDir} />
        <div
          aria-disabled="true"
          className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground/70"
        >
          <BarChart3 className="size-4" />
          통계
          <Badge
            variant="outline"
            className="ml-auto text-[10px] text-muted-foreground"
          >
            준비 중
          </Badge>
        </div>
      </nav>
      <div className="mt-auto flex flex-col gap-3 px-3 pb-4">
        <Separator />
        <div className="flex items-center justify-between">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent"
          >
            <Settings className="size-4" />앱 설정
          </Link>
          <ThemeToggle />
        </div>
        <Link
          href="/design-system"
          className="px-2 text-[11px] text-muted-foreground underline-offset-4 hover:underline"
        >
          디자인 시스템 문서
        </Link>
      </div>
    </aside>
  );
}
