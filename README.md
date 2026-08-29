# AutoQA

QA 팀이 쓰고 있는 **테스트 케이스 문서를 그대로 읽어 실행하고 통과·실패를 판정**하는 검증 도구.

문서를 새로 쓰지 않는다. 마크다운 표에 칸 두 개를 더하면 그 TC 가 자동으로 돈다. QA 담당자는 화면에서 버튼만 누르고, 자동으로 판정되지 않는 것은 직접 찍는다.

## 기술 스택

![Next.js](https://img.shields.io/badge/Next.js-16.3.3-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.8-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3.3-06B6D4?logo=tailwindcss&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.62.1-2EAD33?logo=playwright&logoColor=white)
![Anthropic SDK](https://img.shields.io/badge/Anthropic_SDK-0.122.0-D97757?logo=anthropic&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4.4.3-3E67B1?logo=zod&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11.20.0-F69220?logo=pnpm&logoColor=white)

화면은 **App Router** 와 shadcn/base-ui, 브라우저 조작은 **Playwright**, 구조화 출력 검증은 **Zod** 가 맡는다. TypeScript 는 `strict` 이고 패키지 매니저는 **pnpm 고정** — npm/yarn 을 쓰면 락파일이 갈라진다.

> **Anthropic SDK 는 선택이다.** TC 문서에 실행 방법이 적혀 있으면 모델 없이 돈다. 자연어 절차를 실행 계획으로 바꿀 때만 쓰이고, 그 결과는 캐시되어 TC 가 바뀔 때만 다시 부른다. 키가 없어도 도구 전체가 동작한다.

## 시작하기

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

검증할 프로젝트를 화면에서 등록한다. 경로만 넣으면 TC 문서와 앱 기동 명령을 찾아서 채운다.

| 명령                               | 설명                             |
| ---------------------------------- | -------------------------------- |
| `pnpm dev`                         | 대시보드 (Turbopack)             |
| `pnpm build`                       | 프로덕션 빌드                    |
| `pnpm start`                       | 빌드 결과 실행                   |
| `pnpm lint`                        | ESLint (flat config)             |
| `pnpm exec tsc --noEmit`           | 타입 검사                        |
| `pnpm format`                      | Prettier 적용                    |
| `pnpm autoqa run --project <경로>` | **검증 실행** — 화면 없이 CLI 로 |

## 검증 대상 프로젝트가 준비할 것

리포 루트에 `.autoqa.json` 하나.

```json
{
  "project": "우리 서비스",
  "sources": [{ "adapter": "markdown", "file": "docs/qa/cases.md" }],
  "app": { "start": "pnpm dev", "baseUrl": "http://localhost:3000" }
}
```

그리고 TC 문서의 표에 `실행`·`판정` 칸을 더한다.

```
| ID | P | 절차 | 실행 | 판정 | 기대 결과 |
| TC-RTE-01 | P0 | Accept-Language 없이 / 요청 | GET / | status 307 ; -> /en | /en 으로 307 |
| TC-AUTO-01 | P0 | 테스트 | $ pnpm test | exit 0 | 전 테스트 통과 |
| TC-SRC-09 | P0 | 더보기를 누른다 | open /explore > click text=Load more | js location.search.includes("more=1") | more=1 |
```

**비워두면 그 TC 는 자동 실행되지 않는다.** 되는 것부터 채우면 되고, 자동화하지 않기로 정한 것은 `manual: 이유` 로 적는다 — 그래야 "아직 안 본 것" 과 구분된다.

작성법과 함정은 [docs/TC-GUIDE.md](./docs/TC-GUIDE.md) 에 있다.

## 어떻게 판정하는가

계획의 출처는 셋이고 순서가 있다.

```
1. 문서의 실행 칸   사람이 명시한 것이라 가장 권위 있다        비용 0
2. .autoqa/plans.json   TC 본문이 그대로면 재사용             비용 0
3. 모델            위 둘로 안 되는 것만                      API 키 필요
```

판정도 같다. **상태 코드가 답할 수 있는 질문은 코드가 답한다.** 규칙으로 판정되지 않는 것만 모델로 넘기고, 그것도 실패하면 조용히 통과시키지 않고 대기로 남긴다.

## 상태 다섯

| 상태        | 뜻                                                      |
| ----------- | ------------------------------------------------------- |
| **통과**    | 판정 조건을 만족했다                                    |
| **실패**    | 조건에 어긋났다. 증거가 `.autoqa/latest.json` 에 남는다 |
| **보류**    | QA 가 판단을 미뤘다                                     |
| **대기**    | 아직 아무도 판정하지 않았다 — 검증 밖에 있는 것         |
| **진행 중** | 지금 돌고 있다                                          |

**보류와 대기를 가른 이유**는 "자동으로 못 한 것" 과 "사람이 미룬 것" 이 같은 색이면 무엇이 남았는지 알 수 없기 때문이다. 색만이 아니라 모양으로도 구분한다 — 적록색약에서 통과와 실패는 색으로 구분되지 않는다.

## 산출물

검증 대상 리포의 `.autoqa/` 에 남는다.

| 파일                              | 내용                          | 커밋     |
| --------------------------------- | ----------------------------- | -------- |
| `latest.json`                     | 마지막 실행 결과 (증거 포함)  | 권장     |
| `report.md`                       | 마크다운 리포트               | 권장     |
| `verdicts.json`                   | QA 가 손으로 찍은 판정        | **필수** |
| `plans.json`                      | 모델이 만든 실행 계획 캐시    | 권장     |
| `runs/` `app.log` `progress.json` | 회차별 원본·앱 로그·진행 상태 | 선택     |

`verdicts.json` 은 실행 결과와 따로 둔다. 같은 파일에 두면 다음 회차가 덮어써서 손으로 찍은 판정이 사라진다. 다만 **자동 판정이 있으면 자동이 이긴다** — 사람의 과거 판단이 이번 회차의 실측을 덮으면 회귀를 놓친다.

## 실행 환경

검증 도구가 자기 환경을 대상 앱에 흘리거나 남이 띄운 앱에 붙으면, 나온 통과가 어느 앱의 것인지 알 수 없다.

- autoqa 의 `NODE_ENV`·`PORT` 는 대상에 넘기지 않는다
- `baseUrl` 에 이미 무언가 떠 있으면 **기본적으로 거부**한다 (`app.reuseRunning` 으로만 허용)
- 셸 명령에는 `$BASE_URL` 이 주입된다. 문서에 주소를 박지 않는다

## 문서

| 문서                                                  | 내용                                    |
| ----------------------------------------------------- | --------------------------------------- |
| [TC 작성 가이드](./docs/TC-GUIDE.md)                  | QA 담당자용. 문법·함정·자동화하지 말 것 |
| [tc-triage 스킬](./.claude/skills/tc-triage/SKILL.md) | 에이전트용. 전수 분류 절차              |
