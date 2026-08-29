import { createHash } from "node:crypto";

import type { TestCase } from "@/lib/testcases";

/** TC 본문이 바뀌면 계획을 다시 세워야 한다. 그 판단의 기준. */
export function tcHash(tc: TestCase): string {
  return createHash("sha1")
    .update(`${tc.id}|${tc.name}|${tc.precondition ?? ""}|${tc.expected ?? ""}`)
    .digest("hex")
    .slice(0, 12);
}
