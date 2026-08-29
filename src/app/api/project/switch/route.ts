// 사이드바에서 프로젝트를 갈아탈 때 부른다.
import { NextResponse } from "next/server";

import { switchProject } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { dir } = ((await request.json().catch(() => ({}))) ?? {}) as {
    dir?: string;
  };
  if (!dir) {
    return NextResponse.json({ error: "경로가 없다." }, { status: 400 });
  }
  try {
    await switchProject(dir);
    return NextResponse.json({ dir });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
