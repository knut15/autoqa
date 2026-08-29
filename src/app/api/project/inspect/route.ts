// 등록 화면이 경로를 입력받는 동안 부른다. 나머지 값을 추정해 폼을 채운다.
import { NextResponse } from "next/server";

import { inspectProject } from "@/lib/inspect";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { dir } = ((await request.json().catch(() => ({}))) ?? {}) as {
    dir?: string;
  };
  if (!dir || typeof dir !== "string" || dir.trim() === "") {
    return NextResponse.json({ error: "경로가 없다." }, { status: 400 });
  }
  return NextResponse.json(await inspectProject(dir.trim()));
}
