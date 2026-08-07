import type { Metadata } from "next";
import Link from "next/link";
import InterviewRunner from "@/components/InterviewRunner";
import { getInterview } from "@/lib/interviews";
import { currentOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "면접 연습 진행 중",
  robots: { index: false, follow: false },
};

/**
 * 연습 진행 화면.
 *
 * **질문 목록을 서버에서 다시 받는다.** 시작 응답에만 의존하면 새로고침하거나 새 탭에서 열
 * 때 세션이 미아가 된다. 상세 응답에는 아직 답하지 않은 문항의 <b>답변 뼈대가 없으므로</b>
 * 여기서 다시 받아도 "보고 답하는" 문제가 생기지 않는다.
 */
export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const owner = await currentOwner();

  if (!owner) {
    return (
      <NotAvailable message="세션이 만료되었습니다. 다시 시작해 주세요." />
    );
  }

  let detail: Awaited<ReturnType<typeof getInterview>>;
  try {
    detail = await getInterview(owner.key, sessionId);
  } catch (err) {
    // 남의 세션이거나 없는 세션이면 백엔드가 404 를 준다 — 둘을 구분하지 않는다.
    console.error("[interview] 세션을 불러오지 못했습니다:", err);
    return <NotAvailable message="이 연습 기록을 찾을 수 없습니다." />;
  }

  if (detail.finishedAt) {
    // TODO(면접 기록): /profile/interviews/{id} 가 생기면 그 결과 화면으로 보낸다.
    return <NotAvailable message="이미 마친 연습입니다." />;
  }

  if (detail.questions.length === 0) {
    return <NotAvailable message="출제된 문항이 없습니다." />;
  }

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 20 }}>
          {[detail.company, detail.title].filter(Boolean).join(" · ") || "면접 연습"}
        </h1>
      </section>

      <InterviewRunner
        sessionId={sessionId}
        questions={detail.questions}
        /* 이미 답한 문항 수 = 이어서 시작할 지점. 답변은 문항당 한 행이다. */
        startIndex={Math.min(detail.answers.length, detail.questions.length - 1)}
      />
    </>
  );
}

function NotAvailable({
  message,
  href = "/interview",
  label = "면접 연습으로 돌아가기 →",
}: {
  message: string;
  href?: string;
  label?: string;
}) {
  return (
    <section className="section">
      <div className="empty">
        <p style={{ margin: "0 0 14px" }}>{message}</p>
        <Link href={href} className="cta">
          {label}
        </Link>
      </div>
    </section>
  );
}
