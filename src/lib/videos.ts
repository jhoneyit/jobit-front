import { backendFetch } from "@/lib/backend";

/**
 * 영상 요약 — `jobit` 백엔드 호출. 계약은 `jobit/docs/api.md` 의 "영상 요약".
 *
 * **처리가 비동기다.** POST 는 접수만 하고, 화면은 GET 으로 폴링한다 —
 * 상태 기계는 PENDING → RUNNING → DONE | FAILED | REJECTED(주제 게이트).
 */

export type VideoStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED" | "REJECTED";

export interface VideoReportSection {
  heading: string;
  /** null 이면 모델이 좌표를 확신하지 못한 것 — 딥링크 없이 제목만 보여준다 */
  startSec: number | null;
  summary: string;
}

export interface VideoReport {
  oneLine: string;
  overview: string;
  sections: VideoReportSection[];
  takeaways: string[];
}

export interface VideoSummaryDetail {
  summaryId: string;
  videoId: string;
  url: string;
  title: string | null;
  channel: string | null;
  durationSec: number | null;
  status: VideoStatus;
  /** CAPTION | STT. 완료 전엔 null — 어느 경로일지 몰라 소요 시간도 모른다 */
  source: "CAPTION" | "STT" | null;
  /** FAILED 일 때만. 그대로 화면에 띄워도 되는 문구다 */
  errorMessage: string | null;
  report: VideoReport | null;
  /** 캡처가 존재하는 섹션 시각 목록 — 이미지 영역을 그릴지 판단한다 */
  capturedFrames: number[];
  createdAt: string;
}

export interface VideoSummaryRow {
  summaryId: string;
  videoId: string;
  title: string | null;
  channel: string | null;
  durationSec: number | null;
  status: VideoStatus;
  submittedAt: string;
}

export async function submitVideo(
  ownerKey: string,
  url: string,
): Promise<VideoSummaryDetail> {
  const res = await backendFetch("/api/video-summaries", {
    method: "POST",
    ownerKey,
    body: JSON.stringify({ url }),
  });
  return (await res.json()) as VideoSummaryDetail;
}

/** 공유 링크용 — 소유자 없이 ID 만으로 읽는다 (백엔드도 owner 를 요구하지 않는다). */
export async function getVideoSummary(
  summaryId: string,
): Promise<VideoSummaryDetail> {
  const res = await backendFetch(`/api/video-summaries/${summaryId}`, {});
  return (await res.json()) as VideoSummaryDetail;
}

export async function listVideoSummaries(
  ownerKey: string,
): Promise<VideoSummaryRow[]> {
  const res = await backendFetch("/api/video-summaries", { ownerKey });
  const body = (await res.json()) as { items: VideoSummaryRow[] };
  return body.items;
}

export interface VideoQnaAnswer {
  answer: string;
  /** 답의 근거 시각(초) — 플레이어 시킹 버튼이 된다 */
  refs: number[];
}

/** 영상 내용 질문 — 질문 하나가 GPU 추론 하나라 소유자 한도를 소비한다. */
export async function askVideoQna(
  ownerKey: string,
  summaryId: string,
  question: string,
  history: string[],
): Promise<VideoQnaAnswer> {
  const res = await backendFetch(`/api/video-summaries/${summaryId}/qna`, {
    method: "POST",
    ownerKey,
    body: JSON.stringify({ question, history }),
  });
  return (await res.json()) as VideoQnaAnswer;
}

/** 섹션 캡처 바이트 — 프론트 프록시 라우트가 브라우저 <img> 에 전달한다. */
export async function fetchVideoFrame(
  summaryId: string,
  startSec: number,
): Promise<Response> {
  return backendFetch(`/api/video-summaries/${summaryId}/frame/${startSec}`, {});
}

export async function deleteVideoSubmission(
  ownerKey: string,
  summaryId: string,
): Promise<void> {
  await backendFetch(`/api/video-summaries/${summaryId}`, {
    method: "DELETE",
    ownerKey,
  });
}
