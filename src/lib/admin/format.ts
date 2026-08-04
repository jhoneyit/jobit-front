/** 관리자 화면 표시용 포맷터. */

/** 서버·클라이언트 시간대가 달라 하이드레이션이 어긋나는 것을 막으려 KST 로 고정한다. */
const DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short",
});

export const fmtDateTime = (iso: string) => DATE_TIME.format(new Date(iso));

export const fmtInt = (n: number) => n.toLocaleString("ko-KR");

/** 비용은 센트 단위까지 보이지 않으면 대부분 $0.00 으로 뭉개진다. */
export function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

/** `user:abc123` → `abc123`, `anon:...` → 앞 8자만. */
export function shortOwner(ownerKey: string): string {
  const [prefix, ...rest] = ownerKey.split(":");
  const id = rest.join(":");
  return prefix === "anon" ? `anon:${id.slice(0, 8)}…` : id;
}

export const FEATURE_LABEL: Record<string, string> = {
  JD_PARSE: "JD 파싱",
  QUESTION_GEN: "질문 생성",
  GAP_ANALYSIS: "갭 분석",
  REWRITE: "리라이트",
};

export const KIND_LABEL: Record<string, string> = {
  REQUIRED: "자격요건",
  PREFERRED: "우대사항",
  RESPONSIBILITY: "담당업무",
};
