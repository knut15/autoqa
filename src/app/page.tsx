import { AppSidebar } from "@/components/app-sidebar";
import { RunBoard } from "@/components/qa/run-board";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RUN_INFO, TEST_CASES } from "@/lib/testcases";

export default function Home() {
  return (
    <div className="flex flex-1">
      <AppSidebar />
      <main className="min-w-0 flex-1 space-y-4 p-4 md:p-6">
        <div className="font-heading font-semibold md:hidden">AutoQA</div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{RUN_INFO.project}</CardTitle>
            <CardDescription className="max-w-3xl leading-relaxed">
              {RUN_INFO.description}
            </CardDescription>
            <CardAction>
              <Badge variant="secondary" className="font-mono">
                {RUN_INFO.branch}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-muted-foreground">
            <span>env: {RUN_INFO.environment}</span>
            <span>trigger: {RUN_INFO.trigger}</span>
            <span>started: {RUN_INFO.startedAt}</span>
          </CardContent>
        </Card>
        <RunBoard cases={TEST_CASES} />
      </main>
    </div>
  );
}
