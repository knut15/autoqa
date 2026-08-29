#!/usr/bin/env tsx
// 대상 리포에서 실행한다: pnpm autoqa run
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { projectDir } from "@/lib/project";
import { exitCode, toConsole, toMarkdown } from "@/lib/runner/report";
import { runAll, writeRun } from "@/lib/runner/run";
import { autoqaDir } from "@/lib/runner/store";

const USAGE = `사용법:
  autoqa run [옵션]

옵션:
  --only <접두어>   해당 접두어로 시작하는 TC 만 실행 (예: --only TC-RTE)
  --plan-only       계획만 세우고 실행하지 않는다
  --project <경로>  검증 대상 리포 (기본: 현재 디렉터리, 또는 AUTOQA_PROJECT)
`;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv[0] !== "run") {
    process.stdout.write(USAGE);
    return argv.length === 0 ? 1 : 0;
  }

  const only = value(argv, "--only");
  const projectOverride = value(argv, "--project");
  if (projectOverride) process.env.AUTOQA_PROJECT = projectOverride;

  const dir = projectDir();
  const run = await runAll({
    dir,
    only,
    planOnly: argv.includes("--plan-only"),
    log: (line) => process.stderr.write(`${line}\n`),
  });

  const runFile = await writeRun(dir, run);
  const reportFile = path.join(autoqaDir(dir), "report.md");
  await writeFile(reportFile, toMarkdown(run), "utf8");

  process.stdout.write(`${toConsole(run)}\n\n`);
  process.stdout.write(`결과: ${runFile}\n리포트: ${reportFile}\n`);
  return exitCode(run);
}

function value(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
