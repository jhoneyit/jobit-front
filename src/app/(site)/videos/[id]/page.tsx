import type { Metadata } from "next";
import Link from "next/link";
import VideoStatusPoller from "@/components/VideoStatusPoller";
import { BackendError } from "@/lib/backend";
import { getVideoSummary, type VideoSummaryDetail } from "@/lib/videos";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** SSR 이 살아 있어 공유 링크에 제목이 붙는다 (/result/[id] 와 같은 공유 자산 패턴). */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const summary = await load((await params).id);
  if (!summary) return { title: "요약을 찾을 수 없습니다" };
  return {
    title: summary.title ? `${summary.title} — 영상 요약` : "영상 요약",
    description: summary.report?.oneLine ?? "유튜브 영상을 보고서로 요약합니다.",
  };
}

async function load(id: string): Promise<VideoSummaryDetail | null> {
  try {
    return await getVideoSummary(id);
  } catch (err) {
    if (err instanceof BackendError && err.status === 404) return null;
    throw err;
  }
}

export default async function VideoReportPage({ params }: PageProps) {
  const { id } = await params;
  const summary = await load(id);

  if (!summary) {
    return (
      <section className="section">
        <div className="notice" data-tone="info">
          <p style={{ margin: "0 0 10px" }}>이 요약을 찾을 수 없습니다.</p>
          <Link href="/videos">다른 영상 요약하기 →</Link>
        </div>
      </section>
    );
  }

  const heading = summary.title ?? "영상 요약";

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>{heading}</h1>
        <p>
          {summary.channel && <>{summary.channel} · </>}
          {summary.durationSec ? <>{formatDuration(summary.durationSec)} · </> : null}
          <a href={summary.url} target="_blank" rel="noreferrer">
            유튜브에서 보기 ↗
          </a>
        </p>
      </section>

      {summary.status === "DONE" && summary.report ? (
        <Report summary={summary} />
      ) : summary.status === "REJECTED" ? (
        <div className="notice" data-tone="info">
          <p style={{ margin: "0 0 10px" }}>
            {summary.errorMessage ?? "면접·취업 준비와 관련된 영상만 요약합니다."}
          </p>
          <Link href="/videos">다른 영상 요약하기 →</Link>
        </div>
      ) : summary.status === "FAILED" ? (
        <div className="notice" data-tone="warn">
          <p style={{ margin: "0 0 10px" }}>{summary.errorMessage ?? "요약에 실패했습니다."}</p>
          <Link href="/videos">다시 시도하기 →</Link>
        </div>
      ) : (
        // PENDING·RUNNING — 클라이언트가 폴링하다 끝나면 새로고침한다.
        <VideoStatusPoller summaryId={summary.summaryId} source={summary.source} />
      )}

      <p className="footnote">
        이 페이지 주소를 공유하면 누구나 이 보고서를 볼 수 있습니다.{" "}
        <Link href="/videos">내 요약 목록</Link>
      </p>
    </>
  );
}

function Report({ summary }: { summary: VideoSummaryDetail }) {
  const report = summary.report!;
  return (
    <>
      <section className="section" style={{ marginTop: 0 }}>
        <div className="card">
          <p style={{ margin: 0, fontWeight: 600 }}>{report.oneLine}</p>
          <p style={{ margin: "10px 0 0" }}>{report.overview}</p>
          {summary.source === "STT" && (
            <p className="hint" style={{ margin: "10px 0 0" }}>
              자막이 없어 음성 인식으로 만든 요약입니다 — 고유명사가 부정확할 수 있습니다.
            </p>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>구간별 정리</h2>
          <span className="hint">시각을 누르면 유튜브 해당 장면으로 이동합니다</span>
        </div>
        <ul className="sub-list">
          {report.sections.map((section, i) => (
            <li key={i} className="sub-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                {section.startSec != null && (
                  <a
                    className="chip"
                    href={`https://youtu.be/${summary.videoId}?t=${section.startSec}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {formatTimestamp(section.startSec)}
                  </a>
                )}
                <span className="sub-title">{section.heading}</span>
              </div>
              <p style={{ margin: "6px 0 0" }}>{section.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>핵심 정리</h2>
        </div>
        <div className="card">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {report.takeaways.map((takeaway, i) => (
              <li key={i} style={{ margin: "6px 0" }}>
                {takeaway}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  return m > 0 ? `${m}분` : `${sec}초`;
}
