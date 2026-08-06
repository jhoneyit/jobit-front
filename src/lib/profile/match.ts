import type { ParsedJd, Requirement } from "@/lib/types";
import type { Profile, ProfileFit, RequirementFit, StackFit, YearsFit } from "@/lib/profile/types";

/**
 * 내 프로필 ↔ 공고 요구사항 매칭.
 *
 * **LLM 을 쓰지 않는다.** 질문 생성 호출에 프로필을 넣으면 `question_set` 의 캐시 키
 * `(job_posting_id, prompt_version)` 에 프로필이 붙어 인기 공고도 사용자마다 재생성된다
 * (실측 $0.093 / 62초). 그래서 이미 만들어진 질문을 **정렬·강조**하는 데에만 쓰고,
 * 그 판정은 전부 이 파일의 문자열 비교로 끝낸다.
 *
 * 여기서 나온 결과에 갭 분석의 어휘(MET/WEAK/MISSING)를 쓰지 않는다. 갭 분석은 이력서
 * 문장을 근거로 대지만 이건 스택 이름이 겹치는지만 본다 — 근거의 무게가 다르다.
 */

/**
 * 같은 것을 가리키는 다른 표기를 하나로 모은다.
 *
 * <b>양쪽(내 스택·공고 요구사항)에 똑같이 적용한다.</b> 한쪽에만 적용하면 "TS"라고 적은
 * 사용자가 "TypeScript" 요구사항에 걸리지 않는다.
 */
const ALIAS: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  node: "nodejs",
  golang: "go",
  py: "python",
  k8s: "kubernetes",
  쿠버네티스: "kubernetes",
  postgres: "postgresql",
  psql: "postgresql",
  pg: "postgresql",
  mongo: "mongodb",
  es: "elasticsearch",
  일래스틱서치: "elasticsearch",
  엘라스틱서치: "elasticsearch",
  자바: "java",
  코틀린: "kotlin",
  파이썬: "python",
  스프링: "spring",
  도커: "docker",
  리액트: "react",
  타입스크립트: "typescript",
  자바스크립트: "javascript",
};

/**
 * 문자열 → 정규화 토큰 배열.
 *
 * `.`·`-`·`_` 는 <b>지운다</b> — `node.js`/`spring-boot` 가 두 토큰으로 쪼개지면 안 된다.
 * 나머지 기호에서 자르되 `+`·`#` 는 남긴다 (`c++`, `c#`).
 *
 * <b>한글과 영문 사이도 자른다.</b> 한국어 공고는 조사를 영문에 그대로 붙여 쓴다 —
 * "Spring Boot<u>로</u> REST API 설계", "Java<u>를</u> 다뤄본". 이걸 자르지 않으면 `boot로`
 * 가 한 토큰이 되어 보유 스택 `Spring Boot` 가 걸리지 않는다. 실제 공고에서 바로 드러난
 * 오탐이라, 규칙을 빼면 매칭이 조용히 절반쯤 실패한다.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.\-_]/g, "")
    .replace(/([a-z0-9+#])([가-힣])/g, "$1 $2")
    .replace(/([가-힣])([a-z0-9+#])/g, "$1 $2")
    .split(/[^a-z0-9가-힣+#]+/)
    .filter(Boolean)
    .map((t) => ALIAS[t] ?? t);
}

/**
 * `needle` 토큰열이 `haystack` 안에 <b>연속으로</b> 들어 있는지.
 *
 * 부분 문자열 비교가 아니라 토큰 단위인 것이 중요하다. 문자열로 비교하면 보유 스택 "Go" 가
 * "MongoDB" 에 걸린다 — 실제로 겪기 쉬운 오탐이고, 한 번 나오면 배지 전체를 못 믿게 된다.
 */
function containsSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** 요구사항 본문 + 키워드를 한 덩어리 토큰열로. 키워드도 보면 MATCHED 재현율이 올라간다. */
function requirementTokens(req: Requirement): string[] {
  return tokenize([req.text, ...req.keywords].join(" "));
}

/**
 * 요구사항 하나를 판정한다.
 *
 * <b>UNMATCHED 판단은 공고의 `parsed.stack` 에만 기댄다.</b> 요구사항에 기술이 있는지를
 * 우리가 자체 사전으로 판정하려 들면, 사전에 없는 기술이 나올 때마다 "기술 아님"으로
 * 잘못 넘긴다. 파싱이 이미 공고 단위로 스택을 뽑아 두었으니 그걸 기준으로 삼는다.
 *
 * 파싱이 놓친 기술은 UNMATCHED 가 아니라 NEUTRAL 로 떨어진다 — 없는 근거로 "당신 스택이
 * 아닙니다"라고 말하는 것보다 아무 말도 하지 않는 쪽이 맞다 (스펙 §4.5).
 */
function fitOne(req: Requirement, mineSeqs: string[][], mineLabels: string[], postingSeqs: string[][]): RequirementFit {
  const tokens = requirementTokens(req);

  const matchedStacks = mineLabels.filter((_, i) => containsSequence(tokens, mineSeqs[i]));
  if (matchedStacks.length > 0) {
    return { requirementId: req.id, fit: "MATCHED", matchedStacks };
  }

  const mentionsPostingTech = postingSeqs.some((seq) => containsSequence(tokens, seq));
  const fit: StackFit = mentionsPostingTech ? "UNMATCHED" : "NEUTRAL";
  return { requirementId: req.id, fit, matchedStacks: [] };
}

/**
 * 내 연차 vs 공고 요구 연차.
 *
 * 질문 자체는 바뀌지 않는다 (생성을 건드리지 않으므로). 어느 난이도부터 보면 좋을지
 * 안내 한 줄을 내기 위한 값이다.
 */
export function fitYears(
  mine: number | null,
  required: ParsedJd["yearsOfExperience"],
): YearsFit {
  if (mine === null || !required) return "UNKNOWN";
  const { min, max } = required;
  if (min === null && max === null) return "UNKNOWN";
  if (min !== null && mine < min) return "BELOW";
  if (max !== null && mine > max) return "ABOVE";
  return "WITHIN";
}

/**
 * 프로필과 공고를 맞대어 전체 판정을 낸다.
 *
 * 보유 스택이 하나도 없으면 스택 판정을 아예 하지 않는다 — 그 상태에서 돌리면 기술
 * 요구사항이 전부 UNMATCHED 로 찍혀 "당신은 아무것도 못 합니다"가 된다.
 */
export function matchProfile(
  profile: Profile,
  parsed: ParsedJd,
  requirements: Requirement[],
): ProfileFit {
  const mineLabels = profile.stacks.filter((s) => s.trim().length > 0);
  const mineSeqs = mineLabels.map((s) => tokenize(s));
  const postingSeqs = parsed.stack.map((s) => tokenize(s)).filter((seq) => seq.length > 0);

  const byRequirement: Record<string, RequirementFit> = {};
  let matchedCount = 0;
  let unmatchedCount = 0;
  let neutralCount = 0;

  if (mineSeqs.length > 0) {
    for (const req of requirements) {
      const result = fitOne(req, mineSeqs, mineLabels, postingSeqs);
      byRequirement[req.id] = result;
      if (result.fit === "MATCHED") matchedCount++;
      else if (result.fit === "UNMATCHED") unmatchedCount++;
      else neutralCount++;
    }
  }

  return {
    byRequirement,
    matchedCount,
    unmatchedCount,
    neutralCount,
    years: fitYears(profile.yearsOfExp, parsed.yearsOfExperience),
  };
}

/**
 * 질문 정렬용 가중치 — 낮을수록 먼저 준비해야 한다.
 *
 * <b>스트리밍 중에는 쓰지 않는다.</b> 질문이 하나씩 도착하는 동안 재정렬하면 카드가 눈앞에서
 * 튄다. 스트림이 끝난 뒤 사용자가 정렬을 켰을 때만 적용한다 (`QuestionStream` 참고).
 */
export function questionPriority(fit: RequirementFit | undefined): number {
  if (!fit) return 1; // 어느 요구사항에도 매핑되지 않은 일반 질문
  switch (fit.fit) {
    case "UNMATCHED":
      return 0; // 근거를 준비해야 하는 것부터
    case "NEUTRAL":
      return 1;
    case "MATCHED":
      return 2; // 이미 경험이 있는 것은 뒤로
  }
}
