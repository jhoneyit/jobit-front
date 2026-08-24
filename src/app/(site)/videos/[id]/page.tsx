import type { Metadata } from "next";
import Link from "next/link";
import VideoStatusPoller from "@/components/VideoStatusPoller";
import VideoWorkspace from "@/components/VideoWorkspace";
import VideosShell from "@/components/VideosShell";
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
      <VideosShell>
        <section className="section" style={{ marginTop: 0 }}>
          <div className="notice" data-tone="info">
            <p style={{ margin: "0 0 10px" }}>이 요약을 찾을 수 없습니다.</p>
            <Link href="/videos" className="cta">다른 영상 요약하기 →</Link>
          </div>
        </section>
      </VideosShell>
    );
  }

  // DONE 은 3분할 작업 화면(플레이어·보고서·채팅)이 전부 대신한다 — 전폭 레이아웃.
  if (summary.status === "DONE" && summary.report) {
    return <VideoWorkspace summary={summary} />;
  }

  const heading = summary.title ?? "영상 요약";

  // 대기·진행·실패·거부 — 메뉴 셸 안에서 보여준다. 완료 화면만 3분할 전폭이다.
  return (
    <VideosShell>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>{heading}</h1>
        <p>
          {summary.channel && <>{summary.channel} · </>}
          <a href={summary.url} target="_blank" rel="noreferrer">
            유튜브에서 보기 ↗
          </a>
        </p>
      </section>

      {summary.status === "REJECTED" ? (
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
        <Link href="/videos/history" className="cta">요약 기록</Link>
      </p>
    </VideosShell>
  );
}

