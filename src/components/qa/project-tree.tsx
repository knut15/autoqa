"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, FolderGit2, Plus } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { RegisteredProject } from "@/lib/settings";

/** 대시보드 아래에 등록한 프로젝트를 늘어놓는다. 누르면 그 프로젝트로 갈아탄다. */
export function ProjectTree({
  projects,
  current,
}: {
  projects: RegisteredProject[];
  current?: string;
}) {
  const router = useRouter();
  const [switching, setSwitching] = React.useState<string | null>(null);

  async function go(dir: string) {
    if (dir === current) return;
    setSwitching(dir);
    try {
      const response = await fetch("/api/project/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir }),
      });
      if (response.ok) {
        router.push("/");
        router.refresh();
      }
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="flex flex-col gap-0.5 pt-0.5">
      {projects.map((project) => {
        const active = project.dir === current;
        return (
          <button
            key={project.dir}
            type="button"
            onClick={() => void go(project.dir)}
            disabled={switching !== null}
            title={project.dir}
            aria-current={active ? "true" : undefined}
            className={cn(
              // 들여쓰기와 세로선으로 대시보드에 딸린 것임을 보인다
              "relative ml-4 flex items-center gap-2 rounded-md py-1.5 pr-2 pl-4 text-left text-[13px]",
              "before:absolute before:top-0 before:bottom-0 before:left-0 before:w-px before:bg-border",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50",
            )}
          >
            <FolderGit2 className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            {active ? <Check className="size-3.5 shrink-0" /> : null}
          </button>
        );
      })}

      <Link
        href="/setup"
        className="relative ml-4 flex items-center gap-2 rounded-md py-1.5 pr-2 pl-4 text-[13px] text-muted-foreground/70 before:absolute before:top-0 before:bottom-0 before:left-0 before:w-px before:bg-border hover:bg-sidebar-accent/50"
      >
        <Plus className="size-3.5 shrink-0" />
        프로젝트 추가
      </Link>
    </div>
  );
}
