import type { Metadata } from "next";
import DeleteVideoButton from "@/components/DeleteVideoButton";
import VideoSubmitForm from "@/components/VideoSubmitForm";
import Link from "next/link";
import { currentOwner } from "@/lib/owner";
import { listVideoSummaries, type VideoSummaryRow } from "@/lib/videos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "영상 요약",
  description: "유튜브 영상을 붙여넣으면 타임스탬프가 달린 보고서로 요약합니다.",
};

const STATUS_LABEL: Record<VideoSummaryRow["status"], string> = {
  PENDING: "대기 중",
  RUNNING: "요약 중",
  DONE: "완료",
  FAILED: "실패",
  REJECTED: "대상 아님",
};

export default async function VideosPage() {
  const owner = await currentOwner();

  let rows: VideoSummaryRow[] = [];
  let loadFailed = false;
  if (owner) {
    try {
      rows = await listVideoSummaries(owner.key);
    } catch (err) {
      console.error("[videos] 목록을 불러오지 못했습니다:", err);
      loadFailed = true;
    }
  }

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>영상 요약</h1>
        <p>
          유튜브 영상 주소를 붙여넣으면 자막(없으면 음성 인식)을 읽어{" "}
          <b>타임스탬프가 달린 보고서</b>로 정리합니다. 면접·취업·개발 학습과 관련된 영상만
          요약하며, 이미 요약된 영상은 바로 열립니다.
        </p>
      </section>

      <section className="section" style={{ marginTop: 0 }}>
        <VideoSubmitForm />
      </section>

      {loadFailed ? (
        <div className="notice" data-tone="warn">
          목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </div>
      ) : rows.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>내 요약 {rows.length}건</h2>
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
      ) : null}
    </>
  );
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}시간 ${m}분` : m > 0 ? `${m}분 ${s}초` : `${s}초`;
}
