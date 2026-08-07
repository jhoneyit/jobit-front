import type { Metadata } from "next";
import Link from "next/link";
import {
  getInterview,
  type AnsweredQuestionView,
  type InterviewDetail,
} from "@/lib/interviews";
import { currentOwner } from "@/lib/owner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "면접 기록 상세",
  robots: { index: false, follow: false },
};

/**
 * 한 번의 연습을 문항별로 되짚는다.
 *
 * **점수보다 뼈대 대조가 이 화면의 본체다.** 무엇을 놓쳤는지가 다음 연습에서 바뀔 지점이고,
 * 숫자만 보면 남는 게 없다.
 */
export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const owner = await currentOwner();

  if (!owner) {
    return <NotFound message="세션이 만료되었습니다." />;
  }

  let detail: InterviewDetail;
  try {
    detail = await getInterview(owner.key, sessionId);
  } catch (err) {
    // 남의 기록이든 없는 기록이든 백엔드가 404 를 준다 — 둘을 구분하지 않는다.
    console.error("[interviews] 상세를 불러오지 못했습니다:", err);
    return <NotFound message="이 면접 기록을 찾을 수 없습니다." />;
  }

  const heading =
    [detail.company, detail.title].filter(Boolean).join(" · ") || "제목 없는 공고";
  const finished = detail.finishedAt !== null;

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 20 }}>{heading}</h1>
      </section>

      <div className="iv-detail-head">
        {finished ? (
          <>
            <strong
              className="iv-score-num"
              data-tier={tierOf(detail.totalScore ?? 0)}
            >
              {detail.totalScore}
            </strong>
            <span>점</span>
          </>
        ) : (
          <span className="iv-badge" data-tier="none">
            미완료
          </span>
        )}
        <span className="iv-detail-meta">
          {detail.questionCount}문항 중 {detail.answeredCount}문항에 답했습니다
          {finished && detail.answeredCount < detail.questionCount && (
            <> · 답하지 않은 문항은 0점으로 계산됩니다</>
          )}
        </span>
      </div>

      {!finished && (
        <div className="notice" data-tone="info" style={{ marginBottom: 20 }}>
          아직 마치지 않은 연습입니다.{" "}
          <Link href={`/interview/${sessionId}`}>이어서 연습하기 →</Link>
        </div>
      )}

      {detail.answers.length === 0 ? (
        <div className="empty">
          <p style={{ margin: 0 }}>답변한 문항이 없습니다.</p>
        </div>
      ) : (
        <section className="section" style={{ marginTop: 0 }}>
          <ol className="iv-detail-list">
            {detail.answers.map((answer, i) => (
              <AnswerCard key={answer.questionId} answer={answer} order={i + 1} />
            ))}
          </ol>
        </section>
      )}

      <p style={{ marginTop: 28 }}>
        <Link href="/profile/interviews" className="iv-skip">
          ← 면접 기록으로
        </Link>
      </p>
    </>
  );
}

function AnswerCard({
  answer,
  order,
}: {
  answer: AnsweredQuestionView;
  order: number;
}) {
  const covered = new Set(answer.covered);

  return (
    <li className="iv-detail-item">
      <div className="iv-head">
        <span className="iv-count">{order}</span>
        <span className="chip">{answer.category}</span>
        <span className="iv-detail-score">
          {answer.answered ? (
            <strong data-tier={tierOf(answer.score ?? 0)}>{answer.score}점</strong>
          ) : (
            <span className="iv-unanswered">답변 없음</span>
          )}
        </span>
      </div>

      <p className="iv-detail-question">{answer.questionText}</p>

      <ul className="iv-outline">
        {answer.outline.map((point, i) => (
          <li key={point} data-covered={covered.has(i) || undefined}>
            <span aria-hidden="true">{covered.has(i) ? "✓" : "✗"}</span>
            <span className="sr-only">{covered.has(i) ? "짚음" : "놓침"}</span>
            {point}
          </li>
        ))}
      </ul>

      {answer.feedback && <p className="iv-feedback">{answer.feedback}</p>}

      <Transcript answer={answer} />
    </li>
  );
}

/**
 * 그때 한 답변.
 *
 * **`transcript` 가 없는 경우가 둘이고 `answered` 가 그 둘을 가른다** (`docs/api.md`).
 * 답하지 못한 것과, 보관 기간이 지나 원문만 지워진 것은 사용자에게 전혀 다른 사실이다 —
 * 후자를 "답변 없음"으로 보여주면 자기가 안 한 줄 안다.
 */
function Transcript({ answer }: { answer: AnsweredQuestionView }) {
  if (!answer.answered) {
    return (
      <p className="iv-detail-transcript" data-empty="true">
        제한 시간 안에 답하지 못했습니다.
      </p>
    );
  }

  if (answer.transcript === null) {
    return (
      <p className="iv-detail-transcript" data-empty="true">
        보관 기간이 지나 답변 원문은 지워졌습니다. 점수와 피드백은 그대로 남습니다.
      </p>
    );
  }

  return (
    <details className="iv-detail-transcript-wrap">
      <summary>내가 말한 답변 보기</summary>
      <p className="iv-detail-transcript">{answer.transcript}</p>
    </details>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <section className="section">
      <div className="empty">
        <p style={{ margin: "0 0 14px" }}>{message}</p>
        <Link href="/profile/interviews" className="cta">
          면접 기록으로 →
        </Link>
      </div>
    </section>
  );
}

function tierOf(score: number): "low" | "mid" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}
