import { backendFetch } from "@/lib/backend";
import type { ParsedJd, SubmissionListItem } from "@/lib/types";

/**
 * 제출 이력 — `jobit` 백엔드 호출.
 *
 * **DB 를 직접 읽지 않는다.** 2026-08-04 이관으로 도메인 조회는 저쪽이 갖기로 했는데, 이력만
 * 예외로 `store.ts` 가 Drizzle 로 읽고 있었다. 같은 테이블을 두 레포가 각자의 규칙으로 다루면
 * (특히 승계 규칙) 조용히 갈라진다 — 실제로 갈라져 있었다: 이쪽은 남은 익명 줄을 전부 지웠고,
 * 저쪽은 충돌한 줄만 지운다.
 *
 * 계약은 `jobit/docs/api.md` 의 `/api/submissions`.
 */

/** 백엔드 응답 한 줄. 화면 타입과 달리 `parsed` 를 통째로 준다 (`/api/jd/parse` 와 같은 객체). */
interface SubmissionResponseItem {
  submissionId: string;
  jobPostingId: string;
  company: string | null;
  title: string | null;
  parsed: ParsedJd;
  memo: string | null;
  requirementCount: number;
  questionCount: number;
  updatedAt: string;
  /** 갭 분석 전이면 없다. 로드맵 3단계 전까지는 항상 없다 */
  gapSummary: { met: number; weak: number; missing: number } | null;
}

interface SubmissionPageResponse {
  items: SubmissionResponseItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * 내 기록 목록.
 *
 * 화면이 페이지를 쓰지 않으므로 첫 페이지만 받는다. 백엔드 상한이 100이라 그 이상은 잘린다 —
 * 목록이 그만큼 길어지면 화면에 페이지를 붙여야 한다는 신호다.
 */
export async function listSubmissions(
  ownerKey: string,
  limit = 50,
): Promise<SubmissionListItem[]> {
  const res = await backendFetch(`/api/submissions?page=0&size=${limit}`, {
    ownerKey,
  });
  const body = (await res.json()) as SubmissionPageResponse;

  return body.items.map((item) => ({
    submissionId: item.submissionId,
    jobPostingId: item.jobPostingId,
    company: item.company,
    title: item.title,
    // 파싱이 빈 공고도 있을 수 있어 stack 은 항상 배열로 맞춘다.
    stack: item.parsed?.stack ?? [],
    domain: item.parsed?.domain ?? null,
    updatedAt: item.updatedAt,
    requirementCount: item.requirementCount,
    questionCount: item.questionCount,
  }));
}

/**
 * 내 목록에서 한 줄을 치운다.
 *
 * 공고(`job_posting`)는 남는다 — 여러 사용자가 공유하는 캐시 자산이라 한 사람이 치웠다고
 * 지우면 다른 사람의 캐시 적중까지 깨진다. 그 규칙은 백엔드가 지킨다.
 *
 * 남의 기록 id 를 넣으면 백엔드가 404 를 준다 (`ownerKey` 가 조회 조건에 들어간다).
 */
export async function deleteSubmission(
  ownerKey: string,
  submissionId: string,
): Promise<void> {
  await backendFetch(`/api/submissions/${submissionId}`, {
    method: "DELETE",
    ownerKey,
  });
}

/**
 * 익명으로 쌓은 이력을 계정으로 옮긴다.
 *
 * @returns 실제로 옮겨진 줄 수. 계정에 이미 같은 공고가 있어 버려진 줄은 세지 않는다
 */
export async function claimSubmissions(
  anonOwnerKey: string,
  userOwnerKey: string,
): Promise<number> {
  const res = await backendFetch("/api/submissions/claim", {
    method: "POST",
    ownerKey: userOwnerKey,
    body: JSON.stringify({ fromOwnerKey: anonOwnerKey }),
  });
  const body = (await res.json()) as { moved: number };
  return body.moved;
}
