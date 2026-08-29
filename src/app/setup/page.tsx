import { AppSidebar } from "@/components/app-sidebar";
import { ProjectSetup } from "@/components/qa/project-setup";
import { inspectProject } from "@/lib/inspect";
import { projectDir } from "@/lib/project";
import { readSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // 아직 등록한 적이 없으면 빈 칸에서 시작한다 — cwd 를 채워 넣으면 오히려 헷갈린다.
  const registered = readSettings().projectDir;
  const initial = registered ? await inspectProject(registered) : null;
  return (
    <div className="flex flex-1">
      <AppSidebar />
      <main className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
        <div className="font-heading font-semibold md:hidden">AutoQA</div>
        <ProjectSetup initialDir={registered ?? ""} initial={initial} />
        {!registered ? (
          <p className="px-1 font-mono text-xs text-muted-foreground">
            현재 기준 경로: {projectDir()}
          </p>
        ) : null}
      </main>
    </div>
  );
}
