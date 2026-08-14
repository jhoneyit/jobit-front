import { BackendError, backendFetch } from "@/lib/backend";

/**
 * 갭 분석 · 리라이트 — `jobit` 백엔드 호출. 계약은 `jobit/docs/api.md` 의 "갭 분석"·"리라이트".
 *
 * **분석 시작은 언제나 명시적인 POST 다.** GET 은 캐시된 결과만 돌려주고 없으면 404 — 화면을
 * 그리다 실수로 몇 분짜리 LLM 경로를 태우지 않기 위한 백엔드 규약이고, 이 파일은 404 를
 * `null` 로 바꿔 "아직 분석 안 함"으로 읽게 한다.
 */

export type GapStatus = "MET" | "WEAK" | "MISSING";

export type RequirementKind = "REQUIRED" | "PREFERRED" | "RESPONSIBILITY";

export interface GapEvidence {
  bulletId: string;
  text: string;
}

export interface GapItem {
  /** 리라이트 진입점 — `POST /api/gap-items/{gapItemId}/rewrite` */
  gapItemId: string;
  requirementId: string;
  requirementText: string;
  kind: RequirementKind;
  status: GapStatus;
  /** MISSING 이면 null — "근거 없음"을 그대로 노출한다 (스펙 §4.5) */
  evidence: GapEvidence | null;
  rationale: string;
}

export interface GapAnalysis {
  gapAnalysisId: string;
  cached: boolean;
  createdAt: string;
  summary: { met: number; weak: number; missing: number };
  items: GapItem[];
}

export interface RewriteSuggestion {
  suggestionId: string;
  gapItemId: string;
  bulletId: string;
  original: string;
  /** `[값의 이름]` 대괄호는 지원자가 채울 자리 표시다 — 모델이 숫자를 지어내지 않는다 */
  suggested: string;
  reason: string;
  accepted: boolean;
  cached: boolean;
}

/** 캐시된 분석 결과. 없으면 null — "아직 분석 안 함"이다. */
export async function getGapAnalysis(
  ownerKey: string,
  resumeId: string,
  jobPostingId: string,
): Promise<GapAnalysis | null> {
  try {
    const res = await backendFetch(
      `/api/gap-analyses?resumeId=${resumeId}&jobPostingId=${jobPostingId}`,
      { ownerKey },
    );
    return (await res.json()) as GapAnalysis;
  } catch (err) {
    if (err instanceof BackendError && err.status === 404) return null;
    throw err;
  }
}

/** 분석 실행. 요구사항 수 × 판정이라 **몇 분** 걸릴 수 있다 — 캐시 적중이면 즉시다. */
export async function analyzeGap(
  ownerKey: string,
  resumeId: string,
  jobPostingId: string,
): Promise<GapAnalysis> {
  const res = await backendFetch("/api/gap-analyses", {
    method: "POST",
    ownerKey,
    body: JSON.stringify({ resumeId, jobPostingId }),
  });
  return (await res.json()) as GapAnalysis;
}

/** WEAK 항목의 수정안. thinking 이 켜져 있어 수십 초 걸린다 — 두 번째부터는 캐시다. */
export async function rewriteGapItem(
  ownerKey: string,
  gapItemId: string,
): Promise<RewriteSuggestion> {
  const res = await backendFetch(`/api/gap-items/${gapItemId}/rewrite`, {
    method: "POST",
    ownerKey,
  });
  return (await res.json()) as RewriteSuggestion;
}

/** 채택 여부 기록 — 품질 지표다 (스펙 §3.4). 철회도 같은 경로다. */
export async function setSuggestionAccepted(
  ownerKey: string,
  suggestionId: string,
  accepted: boolean,
): Promise<RewriteSuggestion> {
  const res = await backendFetch(`/api/rewrite-suggestions/${suggestionId}`, {
    method: "PATCH",
    ownerKey,
    body: JSON.stringify({ accepted }),
  });
  return (await res.json()) as RewriteSuggestion;
}
