// 등록 화면의 폴더 열기가 부른다. 서버가 디렉터리를 읽어 목록을 돌려준다.
import { NextResponse } from "next/server";

import { listDir, startDir } from "@/lib/browse";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { dir } = ((await request.json().catch(() => ({}))) ?? {}) as {
    dir?: string;
  };
  return NextResponse.json(await listDir((dir ?? "").trim() || startDir()));
}
