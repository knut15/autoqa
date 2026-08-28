export type TcStatus = "pass" | "fail" | "running" | "pending" | "skipped";

export interface TestCase {
  id: string;
  suite: string;
  name: string;
  status: TcStatus;
  durationMs: number | null;
}

export const RUN_INFO = {
  project: "커머스 웹 회귀 스위트",
  description:
    "매 배포 전 staging 에서 핵심 사용자 흐름을 자동 검증하는 회귀 스위트. 로그인·결제·검색·상품·마이페이지·알림 6개 영역 132개 TC 를 실행하고, 오른쪽 도트에서 실패(다이아몬드)를 누르면 TC 리스트의 해당 케이스로 이동한다.",
  branch: "release/2.14.0",
  environment: "staging",
  trigger: "배포 전 자동 실행",
  startedAt: "2026-08-28 10:12",
};

// mock 데이터: 스위트별 실명 6개 + 회귀 케이스 16개 = 22개 × 6 스위트 = 132 TC
const SUITES: [suite: string, names: string[]][] = [
  [
    "로그인",
    [
      "이메일 로그인 성공",
      "잘못된 비밀번호 5회 차단",
      "카카오 소셜 로그인",
      "세션 만료 후 재로그인 유도",
      "비밀번호 재설정 메일 발송",
      "자동 로그인 유지",
    ],
  ],
  [
    "결제",
    [
      "카드 일반 결제 성공",
      "카카오페이 간편 결제",
      "결제 실패 시 재시도 안내",
      "쿠폰 적용 금액 계산",
      "부분 취소 환불 처리",
      "해외 카드 결제 거절 메시지",
    ],
  ],
  [
    "검색",
    [
      "키워드 자동완성 노출",
      "검색 결과 정렬 변경",
      "검색 결과 없음 안내",
      "최근 검색어 저장·삭제",
      "필터 조합 검색",
      "오타 교정 제안",
    ],
  ],
  [
    "상품",
    [
      "상품 상세 이미지 로딩",
      "옵션 선택 시 가격 갱신",
      "품절 옵션 비활성화",
      "장바구니 담기",
      "리뷰 목록 페이지네이션",
      "연관 상품 추천 노출",
    ],
  ],
  [
    "마이페이지",
    [
      "주문 내역 조회",
      "배송지 추가·수정",
      "회원 정보 변경",
      "탈퇴 처리 및 재가입 제한",
      "포인트 적립 내역",
      "찜 목록 동기화",
    ],
  ],
  [
    "알림",
    [
      "주문 완료 푸시 발송",
      "가격 인하 알림 구독",
      "알림 수신 동의 철회",
      "알림 목록 읽음 처리",
      "야간 발송 제한",
      "이메일 수신함 분류",
    ],
  ],
];

const REGRESSION_PER_SUITE = 16;
// 실행 진행 중 스냅숏: 앞 34개 완료, 35번째 실행 중, 나머지 대기
const COMPLETED_COUNT = 34;
const RUNNING_INDEX = 34;
const FAILED_INDEXES = new Set([6, 11, 21, 29]);
const SKIPPED_INDEXES = new Set([17]);

function statusFor(index: number): TcStatus {
  if (index < COMPLETED_COUNT) {
    if (FAILED_INDEXES.has(index)) return "fail";
    if (SKIPPED_INDEXES.has(index)) return "skipped";
    return "pass";
  }
  return index === RUNNING_INDEX ? "running" : "pending";
}

function buildCases(): TestCase[] {
  const cases: TestCase[] = [];
  for (const [suite, names] of SUITES) {
    const all = [
      ...names,
      ...Array.from(
        { length: REGRESSION_PER_SUITE },
        (_, i) => `${suite} 회귀 ${String(i + 1).padStart(2, "0")}`
      ),
    ];
    for (const name of all) {
      const index = cases.length;
      const status = statusFor(index);
      cases.push({
        id: `TC-${String(index + 1).padStart(3, "0")}`,
        suite,
        name,
        status,
        durationMs:
          status === "pass" || status === "fail"
            ? 380 + ((index * 137) % 2400)
            : null,
      });
    }
  }
  return cases;
}

export const TEST_CASES: TestCase[] = buildCases();

export function summarize(cases: TestCase[]) {
  const counts: Record<TcStatus, number> = {
    pass: 0,
    fail: 0,
    running: 0,
    pending: 0,
    skipped: 0,
  };
  for (const tc of cases) counts[tc.status] += 1;
  return {
    counts,
    done: counts.pass + counts.fail + counts.skipped,
    total: cases.length,
  };
}
