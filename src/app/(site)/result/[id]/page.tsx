import type { Metadata } from "next";
import Link from "next/link";
import QuestionStream from "@/components/QuestionStream";
import RequirementList from "@/components/RequirementList";
import { getJobPosting, getRequirements } from "@/lib/store";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** SSR 이 살아 있으므로 공유 링크에도 제대로 된 제목이 붙는다 (§2). */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const posting = await getJobPosting(id);
  if (!posting) return { title: "공고를 찾을 수 없습니다" };

  const label = [posting.company, posting.title].filter(Boolean).join(" · ");
  return {
    title: label ? `${label} 예상 면접 질문` : "예상 면접 질문",
    description:
      posting.parsed.stack.length > 0
        ? `${posting.parsed.stack.slice(0, 5).join(", ")} 기준 예상 면접 질문과 답변 뼈대.`
        : "이 공고 기준으로 만든 예상 면접 질문과 답변 뼈대.",
  };
}

export default async function ResultPage({ params }: PageProps) {
  const { id } = await params;
  const [posting, requirements] = await Promise.all([
    getJobPosting(id),
    getRequirements(id),
  ]);

  if (!posting) {
    return (
      <section className="section">
        <div className="notice" data-tone="info">
          <p style={{ margin: "0 0 10px" }}>이 공고를 찾을 수 없습니다.</p>
          <Link href="/analyze">공고를 다시 붙여넣기 →</Link>
        </div>
      </section>
    );
  }

  const { parsed } = posting;
  const years = formatYears(parsed.yearsOfExperience);

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>
          {[posting.company, posting.title].filter(Boolean).join(" · ") ||
            "예상 면접 질문"}
        </h1>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>공고에서 읽어낸 것</h2>
        </div>
        <div className="card">
          <dl className="meta-grid">
            {parsed.domain && (
              <>
                <dt>도메인</dt>
                <dd>{parsed.domain}</dd>
              </>
            )}
            {years && (
              <>
                <dt>요구 연차</dt>
                <dd>{years}</dd>
              </>
            )}
            {parsed.stack.length > 0 && (
              <>
                <dt>스택</dt>
                <dd>
                  <div className="chips">
                    {parsed.stack.map((s) => (
                      <span className="chip" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </dd>
              </>
            )}
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>요구사항 {requirements.length}개</h2>
          <span className="hint">질문과 (3단계) 이력서 갭 분석이 공유하는 기준</span>
        </div>
        <RequirementList requirements={requirements} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>예상 질문</h2>
          <span className="hint">요구사항에서 파생된 질문과 답변 뼈대</span>
        </div>
        <QuestionStream jobPostingId={id} requirements={requirements} />
      </section>

      <p className="footnote">
        이 공고는 <Link href="/profile/history">내 기록</Link>에 저장돼 있어 나중에 다시 열어볼 수 있습니다.
        아직 충족 근거가 없는 요구사항을 확인하려면 이력서 갭 분석(3단계)이 필요합니다.
      </p>
    </>
  );
}

function formatYears(
  y: { min: number | null; max: number | null } | null,
): string | null {
  if (!y) return null;
  if (y.min != null && y.max != null) return `${y.min}~${y.max}년`;
  if (y.min != null) return `${y.min}년 이상`;
  if (y.max != null) return `${y.max}년 이하`;
  return null;
}
