/**
 * 스펙 §3 데이터 모델을 그대로 옮긴 타입.
 *
 * 1단계에서는 DB 없이 메모리에만 올리지만, 필드 이름과 형태는 §3의 SQL 스키마와
 * 1:1로 맞춰 둔다. 3단계에서 Drizzle/Prisma 스키마를 붙일 때 이 파일이 기준이 된다.
 */

// ─── §3.1 공고 ────────────────────────────────────────────────────────────

export type RequirementKind = "REQUIRED" | "PREFERRED" | "RESPONSIBILITY";

/** 공고에서 뽑아낸 요구사항. 질문 생성과 갭 분석이 공유하는 앵커. */
export interface Requirement {
  id: string;
  jobPostingId: string;
  text: string;
  kind: RequirementKind;
  /** 매칭·검색용 키워드 */
  keywords: string[];
  sortOrder: number;
}

/** LLM이 JD에서 구조화해 뽑아낸 결과 (job_posting.parsed jsonb) */
export interface ParsedJd {
  company: string | null;
  title: string | null;
  /** 기술 스택 (예: ["Spring Boot", "Kubernetes"]) */
  stack: string[];
  /** 요구 연차. 명시가 없으면 null */
  yearsOfExperience: { min: number | null; max: number | null } | null;
  /** 도메인 (예: "핀테크 결제") */
  domain: string | null;
  /** 공고 전반을 대표하는 키워드 */
  keywords: string[];
}

export interface JobPosting {
  id: string;
  /** 정규화한 본문의 해시. 캐시 키 (§4.1) */
  contentHash: string;
  rawText: string;
  sourceUrl: string | null;
  company: string | null;
  title: string | null;
  parsed: ParsedJd;
  createdAt: string;
}

// ─── §3.2 면접 질문 ───────────────────────────────────────────────────────

export type QuestionCategory =
  | "CS"
  | "STACK"
  | "EXPERIENCE"
  | "DESIGN"
  | "CULTURE";

export interface Question {
  id: string;
  questionSetId: string;
  /** 어느 요구사항에서 나온 질문인지. 매칭 실패 시 null */
  requirementId: string | null;
  text: string;
  category: QuestionCategory;
  /** 1(쉬움) ~ 5(어려움) */
  difficulty: number;
  /** 꼬리질문 배열 (2단계) */
  followups: string[];
  /** 답변 뼈대 — 핵심 포인트 목록 (2단계) */
  answerOutline: string[];
}

export interface QuestionSet {
  id: string;
  jobPostingId: string;
  /** 프롬프트가 바뀌면 재생성 판단용 (§4.2) */
  promptVersion: string;
  model: string;
  createdAt: string;
}

// ─── §3.5 비용 추적 ───────────────────────────────────────────────────────
// 스펙: "처음부터 넣는다. 나중에 넣으려면 귀찮고, 없으면 어느 기능이 돈을 먹는지 안 보인다."

export type LlmFeature = "JD_PARSE" | "QUESTION_GEN" | "GAP_ANALYSIS" | "REWRITE";

export interface LlmCallLog {
  id: string;
  feature: LlmFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  cacheHit: boolean;
  latencyMs: number;
  createdAt: string;
}

// ─── 제출 이력 ────────────────────────────────────────────────────────────

/**
 * "내가 넣은 JD" 목록의 한 줄.
 *
 * 공고(job_posting)는 content_hash 로 전역 중복 제거되는 공유 자산이고,
 * 제출 이력(jd_submission)이 "누가 언제 넣었는지"를 들고 있다. 목록 화면은 후자를 읽는다.
 */
export interface SubmissionListItem {
  /**
   * 삭제 대상 식별자. **jobPostingId 로는 한 줄을 지목할 수 없다** — 같은 공고를 여러 사람이
   * 갖고 있어서, 소유자까지 함께 봐야 줄이 정해진다.
   */
  submissionId: string;
  jobPostingId: string;
  company: string | null;
  title: string | null;
  stack: string[];
  domain: string | null;
  /** 제출 시각이 아니라 **마지막으로 넣은 시각**. 같은 공고를 다시 넣으면 이 값만 갱신된다 */
  updatedAt: string;
  requirementCount: number;
  /** 질문이 아직 생성되지 않았으면 0 */
  questionCount: number;
}

// ─── API 응답 형태 ────────────────────────────────────────────────────────

export interface ParseJdResponse {
  jobPostingId: string;
  parsed: ParsedJd;
  requirements: Requirement[];
  /** content_hash 캐시에 적중했는지 (§4.1) */
  cacheHit: boolean;
}

/** /api/questions 가 SSE 로 흘려보내는 이벤트 */
export type QuestionStreamEvent =
  | { type: "meta"; questionSetId: string; total: number }
  | { type: "question"; question: Question }
  | { type: "done"; count: number }
  | { type: "error"; message: string };
