# 아키텍처

> `curvez:architecture-setup` 이 채운다. 헤딩 문자열은 고정이다 — 구현 에이전트가 이 이름으로 찾는다.

autoqa 는 **대상 프로젝트의 QA 문서를 읽어 실행하고 판정하는 도구**다. 화면과 CLI 가 같은 엔진을
쓰고, 그 엔진은 Node 런타임에서만 돈다. 그래서 경계의 목적은 하나다 — **엔진이 화면에 의존하지
않게 하는 것.** 의존이 생기는 순간 `pnpm autoqa run` 이 브라우저 API 를 찾다가 죽는다.

## 레이어 정의

| 레이어             | 경로                      | 무엇인가                                                        | 런타임        |
| ------------------ | ------------------------- | --------------------------------------------------------------- | ------------- |
| **엔진**           | `src/lib/runner/`         | 실행 · 판정 · 리포트 · 진행 상태 · 결과 저장                    | Node 전용     |
| **어댑터**         | `src/lib/adapters/`       | 대상의 TC 문서를 계획으로 바꾼다 (마크다운, 실행 칸 문법)       | Node 전용     |
| **설정·조회**      | `src/lib/*.ts`            | 매니페스트 · 프로젝트 로드 · 앱 설정 · 자동 탐지 · 공용 타입    | Node 전용\*   |
| **화면**           | `src/components/`         | 대시보드 UI. `ui/` 는 디자인 시스템, `qa/` 는 도메인 컴포넌트   | 브라우저      |
| **라우트**         | `src/app/`                | 페이지(서버 컴포넌트)와 `api/` 라우트 핸들러                    | 양쪽          |
| **CLI**            | `bin/`                    | `pnpm autoqa run` 진입점                                        | Node 전용     |

\* `src/lib/testcases.ts` 와 `src/lib/utils.ts` 는 타입·순수 함수뿐이라 양쪽에서 쓴다.
그 둘만 예외이며 나머지 `src/lib/*` 는 `node:` 를 import 한다.

## 의존 방향

```
bin/ ─────────┐
              ├──▶ src/lib/runner ──▶ src/lib/adapters ──▶ src/lib/manifest
src/app/api/ ─┘         │                    │                    │
                        └────────────────────┴────────────────────┘
                                       ▼
                          src/lib/testcases (타입만)

src/app/(page) ──▶ src/components/qa ──▶ src/components/ui
       │                   │
       └───────────────────┴──▶ src/lib/project · settings (서버 컴포넌트에서만)
```

- **위에서 아래로만 흐른다.** `src/lib` 은 `src/components` 와 `src/app` 을 모르고, 알 필요도 없다
- **화면은 엔진을 직접 부르지 않는다.** `src/app/api/` 의 라우트 핸들러를 거친다.
  클라이언트 컴포넌트가 `runner/execute` 를 import 하면 번들러가 `node:child_process` 를
  브라우저로 끌고 가려다 빌드가 깨진다
- **어댑터는 엔진의 타입만 안다.** 계획(`Plan`)의 모양을 알아야 만들 수 있지만, 실행기를
  부르지는 않는다. 값으로 쓰는 것은 `runner/hash` 하나뿐이며 그것은 순수 함수다

## 금지 import

<!-- 이 표는 quality-gate 가 ' | ' 로 잘라 grep 을 돌린다. 셀에 정렬 공백을 넣지 마라 —
     경로 끝에 공백이 붙으면 파일을 못 찾고 규칙이 조용히 스킵된다. -->

| 규칙 ID | 검사 경로 | 금지 패턴 (ERE) | 이유 |
|---|---|---|---|
| ARCH-001 | src/lib | from ["']@/(components\|app)/ | 엔진이 화면에 의존하면 CLI 에서 못 쓴다. pnpm autoqa run 이 브라우저 API 를 찾다가 죽는다 |
| ARCH-002 | bin | from ["']@/(components\|app)/ | CLI 는 화면 없이 도는 것이 존재 이유다 |
| ARCH-003 | src/components/ui | from ["']@/lib/(runner\|adapters) | 디자인 시스템 프리미티브가 이 앱의 도메인을 알면 다른 화면에 못 쓴다 |
| ARCH-004 | src/components | from ["']node: | 클라이언트 번들에 Node 내장 모듈이 들어가면 빌드가 깨진다 |

**패턴 안의 `\|` 는 표 구분자와 충돌해 이스케이프한 것이다.** 게이트가 읽을 때 `|` 로 되돌린다.

검사는 `curvez:quality-gate` 의 arch 게이트가 돌린다.

```bash
grep -rnE --exclude-dir=node_modules "<패턴>" <검사 경로>
```

## 폴더 구조

```
bin/
  autoqa.mts              CLI 진입점

src/
  app/
    page.tsx              대시보드 (서버 컴포넌트 — loadProject 를 직접 부른다)
    setup/                새 프로젝트 등록
    settings/             앱 전체 설정
    api/
      run/                검증 시작 · 진행 조회
      verdict/            QA 수동 판정
      project/            등록 · 전환 · 제거 · 자동 탐지
  components/
    ui/                   shadcn/base-ui 프리미티브. 도메인을 모른다
    qa/                   대시보드 컴포넌트 (보드 · 진행 · 판정 · 설정 모달 · 프로젝트 트리)
    app-sidebar.tsx
  lib/
    adapters/
      markdown.ts         TC 표 → TestCase[] + Plan[]
      exec-spec.ts        실행 칸 한 줄 → 실행 계획 (문법 파서)
    runner/
      types.ts            Plan · Evidence · Verdict · RunResult
      run.ts              앱 기동 → 실행 → 판정 → 정리
      execute.ts          command · http · browser 실행
      judge.ts            규칙 판정
      judge-model.ts      모델 판정 (규칙으로 안 되는 것만)
      plan.ts             자연어 → 계획 (모델)
      report.ts           마크다운 리포트 · CLI 요약 · 종료 코드
      store.ts            .autoqa/ 산출물 읽기·쓰기
      progress.ts         실행 중 진행 상태
      hash.ts             TC 본문 해시 (계획 캐시 무효화 기준)
    manifest.ts           .autoqa.json 파싱·검증
    project.ts            대상 리포 로드 (매니페스트 + TC + 마지막 실행)
    settings.ts           ~/.autoqa/config.json (등록된 프로젝트)
    inspect.ts            경로 하나로 나머지 자동 탐지
    testcases.ts          TestCase 타입과 집계 (양쪽에서 쓴다)
    utils.ts              cn()

docs/TC-GUIDE.md          QA 담당자용 TC 작성법
.claude/skills/tc-triage  에이전트용 전수 분류 절차
```

## 스택 매핑

| 개념        | 이 저장소에서                                                            |
| ----------- | ------------------------------------------------------------------------ |
| 도메인      | `src/lib/runner/types.ts` — Plan · Evidence · Verdict 가 이 도구의 언어다 |
| 유스케이스  | `src/lib/runner/run.ts` — 검증 한 회차의 전체 흐름                       |
| 어댑터      | `src/lib/adapters/` — 외부 형식(마크다운)을 내부 타입으로                |
| 인프라      | `execute.ts`(셸·fetch·Playwright) · `store.ts`(파일) · `judge-model.ts`(API) |
| 표현        | `src/components/` · `src/app/`                                           |

`profile.json` 의 `architecture: "ddd"` 는 이 매핑을 뜻한다. 다만 **레이어를 폴더로 완전히
가르지는 않았다** — `src/lib/*.ts` 에 설정 로드와 자동 탐지가 섞여 있다. 파일이 열 개 남짓이라
더 나누면 찾기만 어려워진다고 판단했다.

## 예외

| 무엇                                     | 왜                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/app/page.tsx` 가 `lib/project` 직접 호출 | 서버 컴포넌트라 Node 에서 돈다. API 를 한 번 더 거치면 같은 프로세스에서 HTTP 왕복이 생길 뿐이다        |
| `adapters/markdown.ts` 가 `runner/hash` 값 import | 계획 캐시 무효화 기준을 어댑터와 러너가 같은 값으로 계산해야 한다. 해시가 갈리면 캐시가 영영 안 맞는다 |
| `lib/testcases.ts` · `lib/utils.ts` 를 화면이 import | 타입과 순수 함수뿐이다. ARCH-004 가 `node:` 를 막으므로 여기 Node 의존이 들어오면 게이트가 잡는다      |

## 결정 로그

| 무엇을                                             | 왜                                                                                                                              | 되돌릴 위치                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 엔진을 `src/lib/runner` 에 두고 화면과 분리         | CLI 와 대시보드가 같은 엔진을 써야 한다. 화면에 묶으면 `pnpm autoqa run` 이 성립하지 않는다                                     | ARCH-001 · ARCH-002                               |
| 화면은 `src/app/api/` 를 거쳐 엔진을 부른다        | 클라이언트 번들에 `node:child_process` 가 끌려가면 빌드가 깨진다. 서버 컴포넌트만 예외로 직접 부른다                            | ARCH-004, `src/app/api/run/route.ts`              |
| 어댑터를 러너 밖에 둔다                            | 마크다운 말고 Excel·Jira 어댑터가 붙을 자리다. 러너 안에 두면 형식이 늘 때마다 엔진을 고치게 된다                               | `src/lib/adapters/`, `manifest.ts` 의 `ADAPTERS`  |
| 레이어를 폴더로 완전히 가르지 않음                  | `src/lib/*.ts` 가 열 개 남짓이라 더 나누면 찾기만 어려워진다. 파일이 스물을 넘으면 그때 `config/` · `discovery/` 로 가른다      | `src/lib/` 평면 배치                              |
| `testcases.ts` 를 양쪽에서 쓰게 허용                | 타입과 집계 함수뿐이라 Node 의존이 없다. ARCH-004 가 그 전제를 강제한다                                                         | ARCH-004                                          |
