import type { Metadata } from "next";
import Link from "next/link";
import DeleteVideoButton from "@/components/DeleteVideoButton";
import { currentOwner } from "@/lib/owner";
import { listVideoSummaries, type VideoSummaryRow } from "@/lib/videos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "요약 기록",
  // 개인 기록이므로 검색엔진에 올리지 않는다 (내 기록과 같은 성격)
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<VideoSummaryRow["status"], string> = {
  PENDING: "대기 중",
  RUNNING: "요약 중",
  DONE: "완료",
  FAILED: "실패",
  REJECTED: "대상 아님",
};

export default async function VideoHistoryPage() {
  const owner = await currentOwner();

  let rows: VideoSummaryRow[] = [];
  let loadFailed = false;
  if (owner) {
    try {
      rows = await listVideoSummaries(owner.key);
    } catch (err) {
      console.error("[videos/history] 목록을 불러오지 못했습니다:", err);
      loadFailed = true;
    }
  }

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>요약 기록</h1>
        <p>
          {owner?.isLoggedIn
            ? "계정에 저장된 요약입니다. 어느 기기에서 로그인하든 그대로 보입니다."
            : "이 브라우저에서 요약한 영상입니다. 로그인하면 계정으로 옮겨져 다른 기기에서도 보입니다."}
        </p>
      </section>

      {loadFailed ? (
        <div className="notice" data-tone="warn">
          목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <p style={{ margin: "0 0 14px" }}>아직 요약한 영상이 없습니다.</p>
          <Link href="/videos" className="cta">
            영상 요약하기 →
          </Link>
        </div>
      ) : (
        <section className="section" style={{ marginTop: 0 }}>
          <div className="section-head">
            <h2>요약 {rows.length}건</h2>
            <span className="hint">최근에 넣은 순</span>
          </div>
          <ul className="sub-list">
            {rows.map((row) => (
              <li key={row.summaryId} className="sub-item">
                <div className="sub-main">
                  <Link href={`/videos/${row.summaryId}`} className="sub-title">
                    {row.title ?? "제목 확인 중"}
                  </Link>
                  <p className="sub-meta">
                    {row.channel && <span>{row.channel}</span>}
                    {row.channel && <span aria-hidden="true">·</span>}
                    {row.durationSec ? <span>{formatDuration(row.durationSec)}</span> : null}
                    {row.durationSec ? <span aria-hidden="true">·</span> : null}
                    <span>{STATUS_LABEL[row.status]}</span>
                  </p>
                </div>
                <DeleteVideoButton
                  summaryId={row.summaryId}
                  label={row.title ?? "이 영상"}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}시간 ${m}분` : m > 0 ? `${m}분 ${s}초` : `${s}초`;
}
