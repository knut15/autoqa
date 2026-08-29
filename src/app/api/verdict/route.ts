// QA 가 화면에서 통과·실패를 직접 찍을 때 부른다.
import { NextResponse } from "next/server";

import { projectDir } from "@/lib/project";
import { saveHumanVerdict } from "@/lib/runner/store";

export const dynamic = "force-dynamic";

const ALLOWED = ["pass", "fail", "skipped"] as const;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 이 아니다." }, { status: 400 });
  }

  const { tcId, status, note } = (body ?? {}) as {
    tcId?: string;
    status?: string;
    note?: string;
  };

  if (!tcId || typeof tcId !== "string") {
    return NextResponse.json({ error: "tcId 가 없다." }, { status: 400 });
  }
  if (!status || !ALLOWED.includes(status as (typeof ALLOWED)[number])) {
    return NextResponse.json(
      { error: `status 는 ${ALLOWED.join(" | ")} 중 하나여야 한다.` },
      { status: 400 },
    );
  }

  try {
    const run = await saveHumanVerdict(
      projectDir(),
      tcId,
      status as (typeof ALLOWED)[number],
      typeof note === "string" ? note : "",
    );
    return NextResponse.json({ counts: run.counts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
