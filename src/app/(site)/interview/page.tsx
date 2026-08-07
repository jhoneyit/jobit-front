import type { Metadata } from "next";
import Link from "next/link";
import StartInterviewButton from "@/components/StartInterviewButton";
import { currentOwner } from "@/lib/owner";
import { listSubmissions } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "면접 연습",
  description: "분석한 공고의 예상 질문에 소리 내어 답하고 점수를 확인합니다.",
  // 개인 연습이라 검색에 올리지 않는다 (질문 결과 페이지가 공유 자산인 것과 반대).
  robots: { index: false, follow: false },
};

/**
 * 면접 연습 진입점 — 어느 공고로 연습할지 고른다.
 *
 * **질문이 만들어진 공고만 고를 수 있다.** 제약이 아니라 이 기능의 구조다 — 채점 기준이
 * `answer_outline`(질문 생성의 산물)이라, 질문이 없으면 채점할 기준도 없다.
 */
export default async function InterviewPage() {
  const owner = await currentOwner();

  let ready: Awaited<ReturnType<typeof listSubmissions>> = [];
  let pending: typeof ready = [];
  let loadFailed = false;

  if (owner) {
    try {
      const all = await listSubmissions(owner.key);
      ready = all.filter((s) => s.questionCount > 0);
      pending = all.filter((s) => s.questionCount === 0);
    } catch (err) {
      console.error("[interview] 공고 목록을 불러오지 못했습니다:", err);
      loadFailed = true;
    }
  }

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>면접 연습</h1>
        <p>
          분석한 공고의 예상 질문에 <strong>소리 내어</strong> 답하고, 답변 뼈대를 얼마나
          짚었는지 점수로 확인합니다.
        </p>
      </section>

      {loadFailed && (
        <div className="notice" data-tone="warn">
          공고 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </div>
      )}

      {!loadFailed && ready.length === 0 && pending.length === 0 && (
        <div className="empty">
          <p style={{ margin: "0 0 14px" }}>
            아직 분석한 공고가 없습니다. 공고를 먼저 넣어 주세요.
          </p>
          <Link href="/analyze" className="cta">
            공고 붙여넣기 →
          </Link>
        </div>
      )}

      {ready.length > 0 && (
        <section className="section" style={{ marginTop: 0 }}>
          <div className="section-head">
            <h2>연습할 공고 고르기</h2>
            <span className="hint">질문 {ready.length}건 준비됨</span>
          </div>
          <ul className="sub-list">
            {ready.map((s) => (
              <li className="sub-item" key={s.submissionId}>
                <div className="sub-main">
                  <span className="sub-title">
                    {[s.company, s.title].filter(Boolean).join(" · ") || "제목 없는 공고"}
                  </span>
                  {s.stack.length > 0 && (
                    <div className="chips" style={{ marginTop: 8 }}>
                      {s.stack.slice(0, 5).map((tech) => (
                        <span className="chip" key={tech}>
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="sub-meta">
                    <span>질문 {s.questionCount}개</span>
                  </p>
                </div>
                <StartInterviewButton jobPostingId={s.jobPostingId} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        질문이 없는 공고를 숨기지 않고 "질문 먼저 만들기"로 안내한다.
        숨기면 사용자는 자기가 넣은 공고가 왜 목록에 없는지 알 수 없다.
      */}
      {pending.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>질문을 먼저 만들어야 하는 공고</h2>
            <span className="hint">질문이 있어야 채점 기준이 생깁니다</span>
          </div>
          <ul className="sub-list">
            {pending.map((s) => (
              <li className="sub-item" key={s.submissionId}>
                <div className="sub-main">
                  <span className="sub-title">
                    {[s.company, s.title].filter(Boolean).join(" · ") || "제목 없는 공고"}
                  </span>
                </div>
                <Link href={`/result/${s.jobPostingId}`} className="iv-skip">
                  질문 만들기 →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
