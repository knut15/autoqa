import { AppSidebar } from "@/components/app-sidebar";

/** 세 화면(대시보드 · 설정 · 프로젝트 등록)이 같은 사이드바 + 본문 틀을 쓴다. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1">
      <AppSidebar />
      <main className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
        <div className="font-heading font-semibold md:hidden">AutoQA</div>
        {children}
      </main>
    </div>
  );
}
