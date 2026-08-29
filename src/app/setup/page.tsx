import { AppSidebar } from "@/components/app-sidebar";
import { ProjectSetup } from "@/components/qa/project-setup";
import { projectDir } from "@/lib/project";
import { readSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  // 이 화면은 **새 프로젝트를 더하는 자리**다. 지금 보고 있는 프로젝트를 채우면
  // 추가하려던 사람이 기존 것을 덮어쓴다 — 수정은 대시보드의 설정 모달이 맡는다.
  const registered = readSettings().projectDir;
  return (
    <div className="flex flex-1">
      <AppSidebar />
      <main className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
        <div className="font-heading font-semibold md:hidden">AutoQA</div>
        <ProjectSetup />
        <p className="px-1 font-mono text-xs text-muted-foreground">
          {registered
            ? `지금 보는 프로젝트: ${registered} — 그 설정을 고치려면 대시보드의 설정 버튼을 쓴다.`
            : `현재 기준 경로: ${projectDir()}`}
        </p>
      </main>
    </div>
  );
}
