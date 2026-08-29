import { AppSidebar } from "@/components/app-sidebar";
import { LiveBoard } from "@/components/qa/live-board";
import { ProjectSetup } from "@/components/qa/project-setup";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadProject, projectDir, type Project } from "@/lib/project";
import { readSettings } from "@/lib/settings";

// 대상 리포의 파일을 매 요청마다 읽는다. 문서를 고치면 새로고침으로 바로 반영된다.
export const dynamic = "force-dynamic";

export default async function Home() {
  const registered = readSettings().projectDir;
  let project: Project | null = null;
  let failure: string | null = null;
  try {
    project = await loadProject();
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  return (
    <div className="flex flex-1">
      <AppSidebar />
      <main className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
        <div className="font-heading font-semibold md:hidden">AutoQA</div>
        {project ? <Board project={project} /> : null}
        {failure ? (
          <>
            <ProjectSetup initialDir={registered ?? ""} />
            <p className="px-1 font-mono text-xs text-muted-foreground">
              {projectDir()} — {failure}
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}

function Board({ project }: { project: Project }) {
  const { manifest, cases, dir } = project;
  const sources = manifest.sources.map((source) => source.file);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{manifest.project}</CardTitle>
          {manifest.description ? (
            <CardDescription className="max-w-3xl leading-relaxed">
              {manifest.description}
            </CardDescription>
          ) : null}
          <CardAction>
            <Badge variant="secondary" className="font-mono">
              {cases.length} TC
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted-foreground">
          <span className="break-all">repo: {dir}</span>
          <span>source: {sources.join(", ")}</span>
          <span>
            {project.run
              ? `last run: ${project.run.finishedAt}`
              : "last run: 없음 — autoqa run 으로 실행한다"}
          </span>
        </CardContent>
      </Card>
      <LiveBoard
        cases={cases}
        sources={sources}
        priorities={manifest.priorities}
      />
    </>
  );
}
