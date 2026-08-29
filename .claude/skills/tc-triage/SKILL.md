---
name: tc-triage
description: TC 리스트를 전수로 훑어 각 케이스를 무엇으로 검증할 수 있는지 분류하고 실행 칸을 채운다. "TC 분류해줘", "실행 칸 채워줘", "자동 판정 늘려줘", "이 프로젝트 QA 붙여줘", "판정 불가 줄여줘" 라고 하거나 새 프로젝트를 autoqa 에 처음 걸 때 실행한다.
---

# TC 전수 분류

TC 리스트를 받아 **지금 있는 것만으로 무엇을 검증할 수 있는지** 먼저 세고, 그 다음에 대상 프로젝트에 요청한다.

## 순서를 지켜라 — 이게 이 스킬의 전부다

```
1. 전수 훑기   각 TC 를 command / http / browser / manual 로 분류   비용 0
2. 텍스트 집기  화면 조작이 필요하면 사람이 보는 글자로              비용 0
3. testid 요청  1·2 로 안 되는 것만 대상 프로젝트에 요청            앱 코드 수정
```

**3번부터 시작하지 마라.** 대상 팀에 손잡이를 요청하면 그쪽 일정에 묶이고, 요청한 것의 절반은 필요 없던 것으로 드러난다. 실제로 그렇게 30번 왕복한 사례가 있고, 그 뒤 전수 훑기 **한 번**에 9건이 더 열렸다. 그중 텍스트 셀렉터가 필요했던 건 1건뿐이었다.

## 1단계 — 전수 훑기

TC 하나하나를 보고 아래 순서로 묻는다. 위에서 걸리면 거기서 멈춘다.

| 물음                         | 모드      | 예                                                   |
| ---------------------------- | --------- | ---------------------------------------------------- |
| 셸 명령 한 줄로 끝나는가     | `command` | `$ pnpm test` + `exit 0`                             |
| HTTP 요청 한 번으로 끝나는가 | `http`    | `GET /` + `status 307 ; -> /en`                      |
| DOM 속성·개수만 보면 되는가  | `browser` | `js document.querySelectorAll('[lang]').length >= 1` |
| 화면을 조작해야 하는가       | `browser` | `click text=한국어`                                  |
| 위 넷으로 안 되는가          | `manual`  | 시각 인상, 특수 환경, 타이밍                         |

**놓치기 쉬운 자동화 가능 유형** — 이것들은 손잡이가 전혀 필요 없다.

- 상태 코드·리다이렉트: `GET /es/explore` → `status 404`
- 잘못된 파라미터 방어: `?category=zzz` → `status 200`
- 접근성 속성: `role`, `aria-current`, `aria-pressed`, `lang`
- 빌드 게이트: `$ pnpm build`, `$ pnpm test`, `$ pnpm lint`
- 소스 검사: `$ grep -r SERVICE_ROLE src` + `stdout empty`
- 쿠키·localStorage: `js document.cookie.includes('...')`

## 2단계 — 텍스트로 집기

`data-testid` 가 없어도 Playwright 는 사람이 보는 것으로 찾는다.

```
click text=한국어
click text=Load more
```

**TC 문서에 이미 UI 문구가 적혀 있는 경우가 많다.** "카테고리 탭 4개(Places/Culture/Food/Happening)", "Clear search", "Open in maps" — 그대로 쓰면 된다.

다만 텍스트는 로케일마다 바뀌고 문구가 바뀌면 깨진다. **자주 깨지는 자리만 3단계로 승격한다.**

## 3단계 — 대상 프로젝트에 요청

1·2 로 안 되는 것만, 회수가 큰 순서로 묶어서 요청한다.

- 어느 TC 가 열리는지 숫자로 밝힌다 ("담기 손잡이 하나면 11건")
- 값 이름을 제안한다 (`data-testid="save-toggle"`)
- **무엇인지와 어느 것인지를 나눈다** — `data-testid="category-tab"` + `data-category="food"`. 하나로 합치면 "탭 전체" 를 가리킬 수 없다
- 상태는 손잡이가 아니라 `aria-pressed`·`aria-current` 가 전하게 둔다. 그러면 기능 TC 와 접근성 TC 가 함께 열린다

## 실행 칸 문법

`.autoqa.json` 의 `columns` 로 이름을 바꿀 수 있다. 기본은 `실행`·`판정`.

```
| 실행 | 판정 |
| $ pnpm test | exit 0 |
| GET / [Accept-Language: ko-KR] | status 307 ; -> /ko |
| open /en/explore @375x812 | js document.documentElement.scrollWidth <= document.documentElement.clientWidth |
| open /x > click [data-testid=more] > wait 500 | js location.search.includes("more=1") |
```

액션: `click` · `fill 셀렉터 = 값` · `press` · `waitFor` · `wait <ms>` · `goto` · `scroll <px>` · `back`
판정: `exit N` · `status N` · `-> /경로` · `stdout empty` · `stdout has X` · `body has X` · `js <표현식>`

## 함정 — 전부 실제로 밟은 것들

| 증상                                  | 원인                                                  | 해법                                        |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| 표가 깨지고 `Unexpected end of input` | 판정식의 `\|\|` 가 표 구분자로 먹힘                   | `??` 나 옵셔널 체이닝                       |
| `querySelectorAll` `SyntaxError`      | `[data-region=1]` — CSS 는 숫자 시작 값에 따옴표 필요 | `[data-region="1"]`                         |
| `page.click: Timeout`                 | 드롭다운·`<details>` 가 접혀 있음                     | 여는 클릭을 앞에 붙인다                     |
| `body has` 가 화면 문구를 못 찾음     | 스트리밍 앱은 초기 HTTP 응답이 셸뿐                   | `browser` + `js ...innerText.includes(...)` |
| 리다이렉트 기대가 어긋남              | http 모드는 `redirect: manual` — 첫 응답만 본다       | 최종 경로를 직접 요청                       |
| 외부 이미지에 판정이 걸림             | 검증 환경에서 CDN 로드 실패                           | 그 TC 는 자동화하지 않는다                  |
| 개수 판정이 실패                      | 요청 수와 렌더 수는 다르다(필터링)                    | 실측 후 하한으로 (`>= 10`)                  |

## 실패가 나오면 앱을 의심하기 전에 증거를 본다

`.autoqa/latest.json` 의 `evidence` 에 상태 코드·본문·평가 결과가 남는다. **이번 사례에서 나온 실패는 전부 TC 작성 오류였고 앱 결함은 하나도 없었다.** 틀린 실패 하나가 리포트 전체의 신뢰를 깎는다.

판정식을 값 반환으로 바꾸면 실제 수치를 잴 수 있다.

```
js JSON.stringify({y: window.scrollY, h: document.body.scrollHeight})
```

## 자동화하지 않을 것을 정한다

억지로 채우면 통과 수는 늘지만 통과의 의미가 얇아진다.

- **검증이 자기가 재는 지표를 바꾸는 것** — 좋아요를 누르는 TC 를 자동화하면 그 수는 QA 실행 횟수를 센다
- **타이밍에 걸린 것** — 전환 애니메이션, 낙관적 업데이트 판별. flaky 테스트는 없는 것보다 나쁘다
- **특수 환경 전제** — "공급자 하나만 죽은 환경", "API 를 502 로 만들 수 있는 환경"
- **단위 테스트가 덮는 데이터 규칙** — 화면으로는 원인을 가릴 수 없다

이것들은 `manual` 로 남기고 리포트에 이유와 함께 드러낸다.

## 마치면

1. `pnpm autoqa run --project <경로>` 로 실제 실행해 수치를 낸다
2. 실패가 있으면 증거를 보고 TC 작성 오류인지 앱 결함인지 가른다
3. 대상 프로젝트에 요청할 것을 **회수 숫자와 함께** 정리한다
