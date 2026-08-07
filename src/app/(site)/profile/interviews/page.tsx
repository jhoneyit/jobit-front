import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import DeleteInterviewButton from "@/components/DeleteInterviewButton";
import { claimAnonymousInterviews } from "@/lib/claim";
import { listInterviews, type InterviewSummary } from "@/lib/interviews";
import { currentOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "면접 기록",
  // 개인 기록이므로 검색엔진에 올리지 않는다 (질문 결과 페이지와 다른 성격).
  robots: { index: false, follow: false },
};

export default async function InterviewsPage() {
  const session = await auth();

  // 로그인 직후라면 익명으로 연습한 기록을 계정으로 승계한다.
  // 제출 이력과 따로 도는 이유: 이 화면으로 바로 들어온 사람도 옮겨져야 한다.
  let claimed = 0;
  if (session?.user?.id) {
    claimed = await claimAnonymousInterviews(session.user.id);
  }

  const owner = await currentOwner();

  let records: InterviewSummary[] = [];
  let loadFailed = false;
  if (owner) {
    try {
      records = await listInterviews(owner.key);
    } catch (err) {
      console.error("[interviews] 목록을 불러오지 못했습니다:", err);
      loadFailed = true;
    }
  }

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>면접 기록</h1>
        <p>
          {owner?.isLoggedIn
            ? "계정에 저장된 연습 기록입니다. 어느 기기에서 로그인하든 그대로 보입니다."
            : "이 브라우저에 저장된 연습 기록입니다. 로그인하면 계정으로 옮겨집니다."}
        </p>
      </section>

      {claimed > 0 && (
        <div className="notice" data-tone="info" style={{ marginBottom: 20 }}>
          로그인 전에 연습한 기록 {claimed}건을 계정으로 옮겼습니다.
        </div>
      )}

      {loadFailed ? (
        <div className="notice" data-tone="warn">
          기록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </div>
      ) : records.length === 0 ? (
        <div className="empty">
          <p style={{ margin: "0 0 14px" }}>아직 연습한 면접이 없습니다.</p>
          <Link href="/interview" className="cta">
            면접 연습 시작하기 →
          </Link>
        </div>
      ) : (
        <section className="section" style={{ marginTop: 0 }}>
          <div className="section-head">
            <h2>연습 {records.length}건</h2>
            <span className="hint">최근에 연습한 순</span>
          </div>
          <ul className="sub-list">
            {records.map((r) => (
              <InterviewRow key={r.sessionId} record={r} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function InterviewRow({ record }: { record: InterviewSummary }) {
  const heading =
    [record.company, record.title].filter(Boolean).join(" · ") || "제목 없는 공고";
  // 끝내지 않은 연습은 점수가 없다. 0점과 구분해야 한다.
  const finished = record.finishedAt !== null;

  return (
    <li className="sub-item">
      <div className="sub-main">
        <Link href={`/profile/interviews/${record.sessionId}`} className="sub-title">
          {heading}
        </Link>

        <p className="sub-meta">
          {finished ? (
            <span className="iv-badge" data-tier={tierOf(record.totalScore ?? 0)}>
              {record.totalScore}점
            </span>
          ) : (
            <span className="iv-badge" data-tier="none">
              미완료
            </span>
          )}
          <span aria-hidden="true">·</span>
          <span>
            {record.answeredCount} / {record.questionCount}문항
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={record.startedAt}>{formatDate(record.startedAt)}</time>
        </p>

        {/* 이어서 할 수 있는 연습은 그 길을 보여준다 — 안 그러면 미완료가 막다른 길이 된다 */}
        {!finished && (
          <p className="sub-meta">
            <Link href={`/interview/${record.sessionId}`} className="iv-resume">
              이어서 연습하기 →
            </Link>
          </p>
        )}
      </div>

      <DeleteInterviewButton sessionId={record.sessionId} label={heading} />
    </li>
  );
}

function tierOf(score: number): "low" | "mid" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function formatDate(iso: string): string {
  const then = new Date(iso);
  const diffMin = Math.floor((Date.now() - then.getTime()) / 60_000);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;

  return then.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
