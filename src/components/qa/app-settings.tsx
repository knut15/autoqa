"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RegisteredProject } from "@/lib/settings";

/** autoqa 자체의 설정. 개별 프로젝트 설정은 대시보드의 설정 버튼에 있다. */
export function AppSettings({
  projects,
  current,
  settingsPath,
}: {
  projects: RegisteredProject[];
  current?: string;
  settingsPath: string;
}) {
  const router = useRouter();
  const [removing, setRemoving] = React.useState<string | null>(null);

  async function remove(dir: string) {
    setRemoving(dir);
    try {
      await fetch("/api/project/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir }),
      });
      router.refresh();
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>앱 설정</CardTitle>
        <CardDescription>
          autoqa 자체의 설정이다. 개별 프로젝트 설정은 대시보드의 설정 버튼에
          있다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">등록된 프로젝트</span>
          <span className="text-xs text-muted-foreground">
            목록에서 빼도 그 리포의{" "}
            <code className="font-mono">.autoqa.json</code> 과 검증 결과는
            지워지지 않는다.
          </span>
          {projects.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              아직 등록한 프로젝트가 없다.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 pt-1">
              {projects.map((project) => (
                <li
                  key={project.dir}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2",
                    project.dir === current && "bg-accent",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{project.name}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {project.dir}
                    </div>
                  </div>
                  {project.dir === current ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      보는 중
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={removing !== null}
                    onClick={() => void remove(project.dir)}
                    aria-label={`${project.name} 목록에서 빼기`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-1 border-t pt-4">
          <span className="text-xs font-medium text-muted-foreground">
            설정 파일
          </span>
          <code className="font-mono text-xs break-all">{settingsPath}</code>
        </div>
      </CardContent>
    </Card>
  );
}
