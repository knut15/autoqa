# 아키텍처

> `curvez:architecture-setup` 이 채운다. 헤딩 문자열은 고정이다 — 구현 에이전트가 이 이름으로 찾는다.

autoqa 는 **대상 프로젝트의 QA 문서를 읽어 실행하고 판정하는 도구**다. 화면과 CLI 가 같은 엔진을
쓰고, 그 엔진은 Node 런타임에서만 돈다. 그래서 경계의 목적은 하나다 — **엔진이 화면에 의존하지
않게 하는 것.** 의존이 생기는 순간 `pnpm autoqa run` 이 브라우저 API 를 찾다가 죽는다.

## 레이어 정의

| 레이어             | 경로                      | 무엇인가                                                        | 런타임        |
| ------------------ | ------------------------- | --------------------------------------------------------------- | ------------- |
| **엔진**           | `src/lib/runner/`         | 실행 · 판정 · 리포트 · 진행 상태 · 결과 저장 · 대상 앱 수명 관리 | Node 전용     |
| **어댑터**         | `src/lib/adapters/`       | 대상의 TC 문서를 계획으로 바꾼다 (마크다운, 실행 칸 문법)       | Node 전용     |
| **설정·조회**      | `src/lib/*.ts`            | 매니페스트 · 프로젝트 로드 · 앱 설정 · 자동 탐지 · 폴더 탐색 · 공용 타입 | Node 전용\*   |
| **화면**           | `src/components/`         | 대시보드 UI. `ui/` 는 디자인 시스템, `qa/` 는 도메인 컴포넌트   | 브라우저\*\*  |
| **라우트**         | `src/app/`                | 페이지(서버 컴포넌트)와 `api/` 라우트 핸들러                    | 양쪽          |
| **CLI**            | `bin/`                    | `pnpm autoqa run` 진입점                                        | Node 전용     |

\* 브라우저에서도 import 할 수 있는 `src/lib` 모듈은 셋뿐이다.
`src/lib/testcases.ts`(TC 타입과 집계), `src/lib/utils.ts`(`cn()`),
`src/lib/api-types.ts`(화면과 서버가 주고받는 데이터 모양 — `Listing` · `Entry` · `Inspection` ·
`RegisteredProject` · `Progress`)다. 나머지 `src/lib/*` 는 `node:` 를 import 하므로 화면이 보면 안 된다.
`import type` 이라도 보면 안 된다 — 결정 로그의 PLC-04 행 참고.

\*\* 예외가 둘 있다. `src/components/app-shell.tsx` 와 `src/components/app-sidebar.tsx` 는 `"use client"`
가 없는 **서버 컴포넌트**이고, `app-sidebar.tsx` 는 `lib/settings` 의 `readSettings()` 를 값으로 부른다.
`src/components/qa/progress-state.ts` 는 컴포넌트가 아니라 클라이언트 컴포넌트가 쓰는 순수 함수(`isBusy`)다.

## 의존 방향

`A → B` 는 "A 가 B 를 import 해도 된다" 는 뜻이다. 여기 없는 방향은 금지다.

- `bin/` → `src/lib/project` · `src/lib/runner`
- `src/app/api/` → `src/lib/project` · `src/lib/settings` · `src/lib/inspect` · `src/lib/browse` · `src/lib/manifest` · `src/lib/runner`
- `src/app/(페이지)` → `src/components` · `src/lib/project` · `src/lib/settings` · `src/lib/testcases`
- `src/components/app-shell.tsx` · `app-sidebar.tsx` → `src/components/qa` · `src/components/ui` · `src/lib/settings` (서버 컴포넌트라서 허용)
- `src/components/qa` → `src/components/ui` · `src/lib/api-types` · `src/lib/testcases` · `src/lib/utils`
- `src/components/ui` → `src/lib/utils`
- `src/lib/project` → `src/lib/adapters` · `src/lib/manifest` · `src/lib/settings` · `src/lib/runner/store` · `src/lib/runner/types` · `src/lib/testcases`
- `src/lib/runner` → `src/lib/manifest` (타입만) · `src/lib/api-types` (타입만) · `src/lib/testcases`
- `src/lib/adapters` → `src/lib/manifest` · `src/lib/runner/types` (타입만) · `src/lib/runner/hash`
- `src/lib/inspect` → `src/lib/manifest` · `src/lib/api-types` (타입만)
- `src/lib/browse` · `src/lib/settings` → `src/lib/api-types` (타입만)
- `src/lib/api-types` → `src/lib/testcases` (타입만)

규칙은 넷이다.

- **위에서 아래로만 흐른다.** `src/lib` 은 `src/components` 와 `src/app` 을 모르고, 알 필요도 없다
- **화면은 엔진을 직접 부르지 않는다.** `src/app/api/` 의 라우트 핸들러를 거친다.
  클라이언트 컴포넌트가 `runner/execute` 를 import 하면 번들러가 `node:child_process` 를
  브라우저로 끌고 가려다 빌드가 깨진다. 화면이 서버 응답의 모양을 알아야 할 때는
  `src/lib/api-types` 만 본다
- **엔진은 프로젝트를 스스로 로드하지 않는다.** `runAll` 은 로드된 `RunTarget`(대상 경로 ·
  매니페스트 · TC · 계획)을 인자로 받고, 로드는 호출자(`bin/autoqa.mts`, `src/app/api/run/route.ts`)가
  `loadProject()` 로 한다. `lib/project` 는 `runner/store` 를 부르므로 엔진이 `lib/project` 를 부르면
  모듈 순환이 생기고, `lib/project` 는 `~/.autoqa/config.json`(앱 설정)을 읽으므로 엔진이 앱 설정에 묶인다
- **어댑터는 엔진의 타입만 안다.** 계획(`Plan`)의 모양을 알아야 만들 수 있지만, 실행기를
  부르지는 않는다. 값으로 쓰는 것은 `runner/hash` 하나뿐이며 그것은 순수 함수다.
  반대 방향(`runner` → `adapters`)은 없다. TC 문서를 읽는 것은 `lib/project` 의 일이다

## 금지 import

<!-- 이 표는 quality-gate 가 ' | ' 로 잘라 grep 을 돌린다. 셀에 정렬 공백을 넣지 마라 —
     경로 끝에 공백이 붙으면 파일을 못 찾고 규칙이 조용히 스킵된다.
     검사 경로는 규칙 하나에 하나다. 게이트가 공백으로 경로를 나누지 않는다. -->

| 규칙 ID | 검사 경로 | 금지 패턴 (ERE) | 이유 |
|---|---|---|---|
| ARCH-001 | src/lib | from ["']@/(components\|app)/ | 엔진이 화면에 의존하면 CLI 에서 못 쓴다. pnpm autoqa run 이 브라우저 API 를 찾다가 죽는다 |
| ARCH-002 | bin | from ["']@/(components\|app)/ | CLI 는 화면 없이 도는 것이 존재 이유다 |
| ARCH-003 | src/components/ui | from ["']@/lib/(runner\|adapters) | 디자인 시스템 프리미티브가 이 앱의 도메인을 알면 다른 화면에 못 쓴다 |
| ARCH-004 | src/components | from ["']node: | 클라이언트 번들에 Node 내장 모듈이 들어가면 빌드가 깨진다 |
| ARCH-005 | src/components/qa | from ["']@/lib/(runner/\|adapters/\|browse["']\|inspect["']\|settings["']\|project["']\|manifest["']) | 클라이언트 컴포넌트는 node: 를 import 하는 lib 모듈을 보면 안 된다. import type 도 막는다 — type 한 단어를 지우면 node: 가 번들로 끌려오는데 ARCH-004 는 간접 import 를 못 본다. 모양이 필요하면 @/lib/api-types 를 본다 |
| ARCH-006 | src/lib/api-types.ts | from ["'](node:\|@/lib/(runner/\|adapters/\|browse["']\|inspect["']\|settings["']\|project["']\|manifest["'])) | 화면과 서버가 같이 보는 타입 모듈이다. 여기에 Node 의존이 들어오면 ARCH-005 가 막은 경로가 이 파일을 거쳐 다시 열린다 |
| ARCH-007 | src/lib/runner | from ["']@/lib/(project\|settings\|inspect\|browse)["'] | 엔진은 로드된 RunTarget 을 받기만 한다. lib/project 를 부르면 runner/store 와 순환하고, 엔진이 ~/.autoqa/config.json 에 묶여 CI 에서 사용자 홈 설정을 읽게 된다 |

**패턴 안의 `\|` 는 표 구분자와 충돌해 이스케이프한 것이다.** 게이트가 읽을 때 `|` 로 되돌린다.

ARCH-005 · ARCH-006 은 금지할 모듈을 이름으로 적는다. ERE 에는 "이것만 허용" 을 쓸 방법(부정 전방탐색)이
없기 때문이다. **`src/lib` 에 Node 모듈을 새로 만들면 두 패턴에 그 이름을 더한다.** 빠뜨리면 그 모듈은
두 규칙에 걸리지 않고, 남는 방어선은 ARCH-004 와 빌드뿐이다.

ARCH-005 가 `import type` 을 값 import 와 똑같이 막는 이유는 grep 이 둘을 구별하지 못해서다.
prettier 가 긴 import 를 여러 줄로 나누면 `from` 이 있는 줄은 `} from "@/lib/settings";` 만 남는다.

검사는 `curvez:quality-gate` 의 arch 게이트가 돌린다.

```bash
grep -rnE --exclude-dir=node_modules "<패턴>" <검사 경로>
```

## 폴더 구조

```
bin/
  autoqa.mts              CLI 진입점. loadProject() 로 대상을 로드해 runAll 에 넘긴다

src/
  app/
    page.tsx              대시보드 (서버 컴포넌트 — loadProject 를 직접 부른다)
    setup/                새 프로젝트 등록
    settings/             앱 전체 설정
    design-system/        디자인 시스템 확인용 페이지
    api/
      run/                검증 시작 · 진행 조회. loadProject() 로 대상을 로드해 runAll 에 넘긴다
      verdict/            QA 수동 판정
      project/            등록 · 전환 · 제거 · 자동 탐지 · 폴더 탐색(browse/)
  components/
    ui/                   shadcn/base-ui 프리미티브. 도메인을 모른다
    qa/                   대시보드 컴포넌트 (보드 · 진행 · 판정 · 설정 모달 · 프로젝트 트리 · 폴더 선택)
      progress-state.ts   isBusy() — 진행 상태가 끝났는지 판정하는 순수 함수. 클라이언트 컴포넌트가 쓴다
    app-shell.tsx         세 화면이 같이 쓰는 사이드바 + 본문 틀 (서버 컴포넌트)
    app-sidebar.tsx       사이드바. readSettings() 를 부르는 서버 컴포넌트
  lib/
    adapters/
      markdown.ts         TC 표 → TestCase[] + Plan[]
      exec-spec.ts        실행 칸 한 줄 → 실행 계획 (문법 파서)
    runner/
      types.ts            Plan · Evidence · Verdict · RunResult · RunTarget
      run.ts              앱 기동 → 실행 → 판정 → 정리. RunTarget 을 인자로 받는다
      app.ts              대상 앱 수명 관리 (기동 · 준비 대기 · 종료 · package.json 스크립트 조회)
      execute.ts          command · http · browser 실행
      judge.ts            규칙 판정
      judge-model.ts      모델 판정 (규칙으로 안 되는 것만)
      plan.ts             자연어 → 계획 (모델)
      report.ts           마크다운 리포트 · CLI 요약 · 종료 코드
      store.ts            .autoqa/ 산출물 읽기·쓰기
      progress.ts         실행 중 진행 상태 파일 읽기·쓰기 (Progress 타입은 api-types.ts)
      hash.ts             TC 본문 해시 (계획 캐시 무효화 기준)
    api-types.ts          화면과 서버가 주고받는 모양 (Listing · Entry · Inspection · RegisteredProject · Progress). 양쪽에서 쓴다
    manifest.ts           .autoqa.json 파싱·검증
    project.ts            대상 리포 로드 (매니페스트 + TC + 마지막 실행). 엔진이 아니라 진입점이 부른다
    settings.ts           ~/.autoqa/config.json (등록된 프로젝트)
    inspect.ts            경로 하나로 나머지 자동 탐지
    browse.ts             폴더 탐색. 브라우저가 로컬 절대 경로를 주지 않아 서버가 대신 읽는다
    testcases.ts          TestCase 타입과 집계 (양쪽에서 쓴다)
    utils.ts              cn() (양쪽에서 쓴다)

docs/TC-GUIDE.md          QA 담당자용 TC 작성법
.claude/skills/tc-triage  에이전트용 전수 분류 절차
```

## 스택 매핑

| 개념        | 이 저장소에서                                                            |
| ----------- | ------------------------------------------------------------------------ |
| 도메인      | `src/lib/runner/types.ts` — Plan · Evidence · Verdict 가 이 도구의 언어다 |
| 유스케이스  | `src/lib/runner/run.ts` — 검증 한 회차의 전체 흐름                       |
| 어댑터      | `src/lib/adapters/` — 외부 형식(마크다운)을 내부 타입으로                |
| 인프라      | `execute.ts`(셸·fetch·Playwright) · `app.ts`(대상 앱 프로세스) · `store.ts`(파일) · `judge-model.ts`(API) |
| 표현        | `src/components/` · `src/app/`                                           |

`profile.json` 의 `architecture: "ddd"` 는 이 매핑을 뜻한다. 다만 **레이어를 폴더로 완전히
가르지는 않았다** — `src/lib/*.ts` 에 설정 로드와 자동 탐지가 섞여 있다. 파일이 열 개 남짓이라
더 나누면 찾기만 어려워진다고 판단했다.

## 예외

| 대상 | 허용 범위 | 만료 조건 |
|---|---|---|
| `src/app/page.tsx` 가 `lib/project` 직접 호출 | 서버 컴포넌트라 Node 에서 돈다. API 를 한 번 더 거치면 같은 프로세스에서 HTTP 왕복이 생길 뿐이다 | 없음. `page.tsx` 에 `"use client"` 가 붙으면 그 즉시 무효 |
| `adapters/markdown.ts` 가 `runner/hash` 값 import | 계획 캐시 무효화 기준을 어댑터와 러너가 같은 값으로 계산해야 한다. 해시가 다르면 캐시가 영영 안 맞는다 | 없음. `hash.ts` 가 순수 함수가 아니게 되면 무효 |
| `lib/testcases.ts` · `lib/utils.ts` · `lib/api-types.ts` 를 화면이 import | 타입과 순수 함수뿐이다. `api-types.ts` 는 ARCH-006 이 Node 의존을 막는다. `testcases.ts` · `utils.ts` 에는 그런 규칙이 없고 빌드가 잡는다 | 없음 |
| `src/components/app-sidebar.tsx` 가 `lib/settings` 값 import | `"use client"` 가 없는 서버 컴포넌트라서다. 그래서 ARCH-005 의 검사 경로를 `src/components` 가 아니라 `src/components/qa` 로 잡았다 | 없음. `app-sidebar.tsx` 에 `"use client"` 가 붙으면 그 즉시 무효 |

## 결정 로그

| 무엇을 | 왜 | 되돌릴 위치 |
|---|---|---|
| 엔진을 `src/lib/runner` 에 두고 화면과 분리 | CLI 와 대시보드가 같은 엔진을 써야 한다. 화면에 묶으면 `pnpm autoqa run` 이 성립하지 않는다 | .curvez/architecture.md:금지 import (ARCH-001 · ARCH-002) |
| 화면은 `src/app/api/` 를 거쳐 엔진을 부른다 | 클라이언트 번들에 `node:child_process` 가 끌려가면 빌드가 깨진다. 서버 컴포넌트만 예외로 직접 부른다 | .curvez/architecture.md:금지 import (ARCH-004, `src/app/api/run/route.ts`) |
| 어댑터를 러너 밖에 둔다 | 마크다운 말고 Excel·Jira 어댑터가 붙을 자리다. 러너 안에 두면 형식이 늘 때마다 엔진을 고치게 된다 | .curvez/architecture.md:폴더 구조 (`src/lib/adapters/`, `manifest.ts` 의 `ADAPTERS`) |
| 레이어를 폴더로 완전히 가르지 않음 | `src/lib/*.ts` 가 열 개 남짓이라 더 나누면 찾기만 어려워진다. 파일이 스물을 넘으면 그때 `config/` · `discovery/` 로 나눈다 | .curvez/architecture.md:스택 매핑 (`src/lib/` 평면 배치) |
| `testcases.ts` 를 양쪽에서 쓰게 허용 | 타입과 집계 함수뿐이라 Node 의존이 없다 | .curvez/architecture.md:예외 |
| PLC-04: 화면이 보는 응답 모양 타입(`Listing` · `Entry` · `Inspection` · `RegisteredProject` · `Progress`)을 `node:` 가 없는 `src/lib/api-types.ts` 로 옮기고, 서버 모듈과 클라이언트 컴포넌트가 둘 다 여기서 import 한다. ARCH-005 · ARCH-006 으로 강제한다 | 비용은 약 14개 파일이지만 전부 import 경로만 바뀌는 기계적 수정이다. 경계가 "파일" 단위가 되므로 arch 게이트의 grep 이 여러 줄 import 까지 정확히 잡는다. 이미 쓰고 있는 `testcases.ts`(양쪽이 보는 타입 모듈) 방식과도 같다. **기각한 안:** `import type` 을 허용하고 값 import 만 막는다 — 소스 수정은 `eslint.config.mjs` 하나(typescript-eslint `no-restricted-imports` 의 `allowTypeImports`, 설치본 8.68.0 에 있음)로 싸지만, grep 은 여러 줄 import 에서 type 과 값을 구별하지 못해 이 표에 규칙으로 적을 수 없다. 규칙이 lint 설정에만 있고 이 문서에는 없게 된다. 또 클라이언트가 Node 모듈 파일을 계속 보고 있어, `type` 한 단어가 지워지면 lint 가 돌기 전까지는 막을 것이 없다 | .curvez/architecture.md:금지 import (ARCH-005 · ARCH-006) |
| PLC-05: `runAll` 이 `RunTarget`(dir · manifest · cases · plans, `runner/types.ts`)을 옵션으로 받고, `loadProject()` 는 호출자 둘(`bin/autoqa.mts`, `src/app/api/run/route.ts`)이 부른다. ARCH-007 로 강제한다 | 비용은 4~5개 파일이다. 지금은 `run.ts → project → runner/store` 로 모듈이 순환하고, 엔진이 `~/.autoqa/config.json` 까지 읽는다. 또 `runAll` 은 `options.dir` 를 받으면서도 대상은 `projectDir()` 로 따로 찾는다. 두 값이 다르면 결과를 다른 리포에 쓴다. 인자로 받으면 이 셋이 모두 없어진다. `RunTarget` 을 `runner/types.ts` 에 두는 이유는 `Project` 타입을 `lib/project` 에서 가져오면 그것 자체가 ARCH-007 위반이기 때문이다. `Project` 는 구조가 같아 그대로 넘길 수 있다. **기각한 안 1:** 의존 방향에 `runner → project` 를 추가해 현 상태를 인정한다 — 비용 0 이지만 순환과 앱 설정 의존이 그대로 남고, 게이트로 막을 규칙도 없다. **기각한 안 2:** 엔진이 `adapters` 를 직접 불러 스스로 로드한다 — `loadProject` 의 병합 로직이 두 벌이 된다 | .curvez/architecture.md:금지 import (ARCH-007) |
| ARCH-005 의 검사 경로를 `src/components/qa` 로 한정 | 게이트는 규칙 하나에 경로 하나만 읽는다. `src/components` 로 잡으면 서버 컴포넌트인 `app-sidebar.tsx` 의 정당한 `readSettings()` 호출이 위반으로 잡힌다. `src/components/ui` 는 ARCH-003 이 이미 본다 | .curvez/architecture.md:금지 import (ARCH-005) |
| 의존 방향을 그림에서 화살표 목록으로 바꿈 | 이전 그림에는 코드에 없는 `runner → adapters` 화살표가 있었다(실제로는 `adapters → runner/types · hash` 와 `project → adapters`). 목록은 한 줄에 한 관계라 코드와 한 줄씩 대조할 수 있다 | .curvez/architecture.md:의존 방향 |
