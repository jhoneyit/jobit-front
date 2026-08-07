import { backendFetch } from "@/lib/backend";

/**
 * 면접 연습 — `jobit` 백엔드 호출.
 *
 * **오디오는 여기를 지나가지 않는다.** STT 는 브라우저(Web Speech API)가 하고, 이 레포도
 * 백엔드도 텍스트만 다룬다. 그래서 멀티파트도 업로드 상한도 없다.
 *
 * 계약은 `jobit/docs/api.md` 의 `/api/interviews`.
 */

export type QuestionCategory =
  | "CS"
  | "STACK"
  | "EXPERIENCE"
  | "DESIGN"
  | "CULTURE";

export interface InterviewQuestion {
  questionId: string;
  text: string;
  category: QuestionCategory;
  difficulty: number;
  /** 이 문항에 주어진 시간(초). 설정이 바뀌어도 세션 중에는 이 값이 유지된다 */
  timeLimitSec: number;
}

export interface StartedInterview {
  sessionId: string;
  jobPostingId: string;
  questionCount: number;
  /** **답변 뼈대가 없다.** 보고 답하면 연습이 아니다 — 뼈대는 채점 후에 온다 */
  questions: InterviewQuestion[];
}

export interface ScoredAnswer {
  questionId: string;
  /** false 면 시간 내에 답하지 못한 것이다. 점수 0 은 채점 결과가 아니라 그 사실의 표현 */
  answered: boolean;
  score: number;
  /** 채점 후 처음 공개되는 답변 뼈대. covered/missed 가 이 목록의 인덱스를 가리킨다 */
  outline: string[];
  covered: number[];
  missed: number[];
  feedback: string | null;
  answeredCount: number;
  questionCount: number;
}

export interface FinishedInterview {
  sessionId: string;
  /** 출제된 **전** 문항의 평균. 미답변은 0점으로 센다 */
  totalScore: number;
  answeredCount: number;
  questionCount: number;
  finishedAt: string;
}

export interface InterviewSummary {
  sessionId: string;
  jobPostingId: string;
  company: string | null;
  title: string | null;
  /** 종료 전이면 null. 0 과 구분해야 한다 — "안 끝냈다"와 "끝냈는데 0점"은 다르다 */
  totalScore: number | null;
  answeredCount: number;
  questionCount: number;
  startedAt: string;
  finishedAt: string | null;
}

export async function startInterview(
  ownerKey: string,
  jobPostingId: string,
): Promise<StartedInterview> {
  const res = await backendFetch("/api/interviews", {
    method: "POST",
    ownerKey,
    body: JSON.stringify({ jobPostingId }),
  });
  return (await res.json()) as StartedInterview;
}

/**
 * 답변을 제출하고 즉시 채점받는다.
 *
 * `transcript` 가 비어 있는 것은 오류가 아니다 — 제한 시간 안에 한마디도 못 한 경우가 정상
 * 경로다. 백엔드가 LLM 을 부르지 않고 0점으로 기록한다.
 */
export async function submitAnswer(
  ownerKey: string,
  sessionId: string,
  input: { questionId: string; transcript: string; durationMs: number },
): Promise<ScoredAnswer> {
  const res = await backendFetch(`/api/interviews/${sessionId}/answers`, {
    method: "POST",
    ownerKey,
    body: JSON.stringify(input),
  });
  return (await res.json()) as ScoredAnswer;
}

export async function finishInterview(
  ownerKey: string,
  sessionId: string,
): Promise<FinishedInterview> {
  const res = await backendFetch(`/api/interviews/${sessionId}/finish`, {
    method: "POST",
    ownerKey,
  });
  return (await res.json()) as FinishedInterview;
}

export interface AnsweredQuestionView {
  questionId: string;
  questionText: string;
  category: QuestionCategory;
  difficulty: number;
  answered: boolean;
  /**
   * null 인 경우가 둘이고 `answered` 가 그 둘을 가른다:
   * `answered=false` → 시간 내에 답하지 못했다 / `answered=true` → TTL 이 지나 원문만 지웠다.
   */
  transcript: string | null;
  score: number | null;
  outline: string[];
  covered: number[];
  missed: number[];
  feedback: string | null;
  durationMs: number;
  timeLimitSec: number;
}

export interface InterviewDetail extends InterviewSummary {
  /** 출제된 문항. **답변 뼈대가 없다** — 뼈대는 채점된 `answers` 안에만 있다 */
  questions: InterviewQuestion[];
  answers: AnsweredQuestionView[];
}

export async function getInterview(
  ownerKey: string,
  sessionId: string,
): Promise<InterviewDetail> {
  const res = await backendFetch(`/api/interviews/${sessionId}`, { ownerKey });
  return (await res.json()) as InterviewDetail;
}

export async function listInterviews(
  ownerKey: string,
  limit = 50,
): Promise<InterviewSummary[]> {
  const res = await backendFetch(`/api/interviews?page=0&size=${limit}`, {
    ownerKey,
  });
  const body = (await res.json()) as { items: InterviewSummary[] };
  return body.items;
}

/** 익명으로 쌓은 연습 기록을 계정으로 옮긴다. @returns 옮겨진 세션 수 */
export async function claimInterviews(
  anonOwnerKey: string,
  userOwnerKey: string,
): Promise<number> {
  const res = await backendFetch("/api/interviews/claim", {
    method: "POST",
    ownerKey: userOwnerKey,
    body: JSON.stringify({ fromOwnerKey: anonOwnerKey }),
  });
  const body = (await res.json()) as { moved: number };
  return body.moved;
}
