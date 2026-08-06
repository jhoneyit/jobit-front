/**
 * 내 정보(프로필) 타입.
 *
 * 공고 파싱이 뽑아내는 건 전부 "공고가 원하는 것"이다. 여기 있는 건 "내가 가진 것"이고,
 * 둘을 맞대야 교집합/차집합이 나온다. 직무·관심분야는 일부러 받지 않는다 — 공고에서
 * 이미 나오는 정보라 두 곳이 서로 다른 말을 하게 된다.
 */

/**
 * 한 사람이 넣을 수 있는 스택 개수. 무제한이면 jsonb 가 비대해지고 화면도 못 쓴다.
 *
 * <b>상수가 store.ts 가 아니라 여기 있는 이유</b>: 입력 폼(클라이언트 컴포넌트)이 이 값을
 * 쓰는데, store.ts 를 임포트하면 Drizzle → postgres-js 가 통째로 브라우저 번들로 끌려온다.
 * 이 파일은 DB 를 모르는 순수 타입 모듈이라 양쪽에서 안전하게 쓸 수 있다.
 */
export const MAX_STACKS = 30;

/** 스택 이름 한 개의 길이 상한. */
export const MAX_STACK_LENGTH = 40;

export interface Profile {
  /** 본인 경력(년). 미입력이면 null — 0(신입)과 구분한다. */
  yearsOfExp: number | null;
  /** 보유 스택. 사용자가 적은 표기 그대로 저장하고, 정규화는 읽는 쪽에서 한다. */
  stacks: string[];
}

export const EMPTY_PROFILE: Profile = { yearsOfExp: null, stacks: [] };

/** 프로필이 비어 있으면 화면에서 아무것도 보여주지 않는다. */
export function isProfileEmpty(profile: Profile | null): boolean {
  return !profile || (profile.yearsOfExp === null && profile.stacks.length === 0);
}

/**
 * 요구사항 하나에 대한 판정.
 *
 * **3-state 인 것이 핵심이다.** 2-state 로 두면 "코드 리뷰 문화에 익숙하신 분" 같은
 * 비기술 요구사항이 전부 "내 스택 아님"으로 잘못 찍힌다.
 */
export type StackFit =
  /** 내 보유 스택이 요구사항에 등장한다 */
  | "MATCHED"
  /** 요구사항이 공고의 기술을 명시하는데 내 것과 겹치지 않는다 */
  | "UNMATCHED"
  /** 기술 이야기가 아니다 (협업·담당업무 등). 판단하지 않는다 */
  | "NEUTRAL";

export interface RequirementFit {
  requirementId: string;
  fit: StackFit;
  /** MATCHED 일 때 어떤 보유 스택이 걸렸는지. 화면에 근거로 보여준다. */
  matchedStacks: string[];
}

/** 내 연차와 공고 요구 연차의 관계. */
export type YearsFit =
  | "BELOW"
  | "WITHIN"
  | "ABOVE"
  /** 내 연차나 공고 요구 연차 중 하나라도 없으면 비교하지 않는다 */
  | "UNKNOWN";

export interface ProfileFit {
  /**
   * 요구사항 id → 판정. Map 이 아니라 평범한 객체인 이유는 이 값이 서버 컴포넌트에서
   * 클라이언트 컴포넌트로 건너가기 때문이다 — 직렬화가 되는지 고민할 필요가 없다.
   */
  byRequirement: Record<string, RequirementFit>;
  matchedCount: number;
  unmatchedCount: number;
  neutralCount: number;
  years: YearsFit;
}
