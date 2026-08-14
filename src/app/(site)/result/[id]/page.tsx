import type { Metadata } from "next";
import Link from "next/link";
import GapSection from "@/components/GapSection";
import QuestionStream from "@/components/QuestionStream";
import RequirementList from "@/components/RequirementList";
import { getGapAnalysis, type GapAnalysis } from "@/lib/gap";
import { currentOwner } from "@/lib/owner";
import { matchProfile } from "@/lib/profile/match";
import { readMyProfile } from "@/lib/profile/session";
import { isProfileEmpty, type ProfileFit } from "@/lib/profile/types";
import { listResumes, type ResumeSummary } from "@/lib/resumes";
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
  const [posting, requirements, { profile }] = await Promise.all([
    getJobPosting(id),
    getRequirements(id),
    readMyProfile(),
  ]);

  // 갭 분석 초기 상태 — 가장 최근 이력서와 캐시된 결과(있으면). 실패해도 이 화면의
  // 나머지(질문·요구사항)는 온전해야 하므로 조용히 비운다.
  let gapResume: ResumeSummary | null = null;
  let gapInitial: GapAnalysis | null = null;
  const owner = await currentOwner();
  if (owner) {
    try {
      const resumes = await listResumes(owner.key);
      gapResume = resumes[0] ?? null; // 최신 먼저 — gapSummary 와 같은 "최근 하나" 규약
      if (gapResume) {
        gapInitial = await getGapAnalysis(owner.key, gapResume.resumeId, id);
      }
    } catch (err) {
      console.error("[result] 갭 분석 초기 상태를 불러오지 못했습니다:", err);
    }
  }

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

  // 프로필이 비어 있으면 판정 자체를 하지 않는다 — 이 화면은 프로필 없이도 온전해야 한다.
  const fit =
    profile && !isProfileEmpty(profile)
      ? matchProfile(profile, parsed, requirements)
      : null;

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

      {fit && <ProfileSummary fit={fit} total={requirements.length} />}

      <section className="section">
        <div className="section-head">
          <h2>요구사항 {requirements.length}개</h2>
          <span className="hint">질문과 (3단계) 이력서 갭 분석이 공유하는 기준</span>
        </div>
        <RequirementList requirements={requirements} fits={fit?.byRequirement} />
      </section>

      <GapSection
        jobPostingId={id}
        resume={
          gapResume
            ? { resumeId: gapResume.resumeId, bulletCount: gapResume.bulletCount }
            : null
        }
        initial={gapInitial}
      />

      <section className="section" id="questions">
        <div className="section-head">
          <h2>예상 질문</h2>
          <span className="hint">요구사항에서 파생된 질문과 답변 뼈대</span>
        </div>
        <QuestionStream
          jobPostingId={id}
          requirements={requirements}
          fits={fit?.byRequirement}
        />
      </section>

      <p className="footnote">
        이 공고는 <Link href="/profile/history">내 기록</Link>에 저장돼 있어 나중에 다시 열어볼 수 있습니다.
      </p>
    </>
  );
}

/**
 * 내 정보 기준 요약.
 *
 * <b>갭 분석의 어휘를 쓰지 않는다.</b> 여기서 본 것은 스택 이름이 겹치는지뿐이라
 * "충족/미충족"이라고 말할 근거가 없다 — 그 판정은 이력서를 받는 3단계의 몫이다 (스펙 §4.5).
 */
function ProfileSummary({ fit, total }: { fit: ProfileFit; total: number }) {
  const yearsNote =
    fit.years === "BELOW"
      ? "공고가 요구하는 연차보다 낮습니다. 난이도가 높은 질문부터 준비해 두면 좋습니다."
      : fit.years === "ABOVE"
        ? "공고가 요구하는 연차보다 높습니다. 트레이드오프를 묻는 질문에서 깊이를 보여야 합니다."
        : null;

  const judged = fit.matchedCount + fit.unmatchedCount;

  return (
    <div className="notice" data-tone="info" style={{ marginTop: 24 }}>
      <p style={{ margin: 0 }}>
        {judged === 0 ? (
          <>
            요구사항 {total}개 중 내 보유 스택과 맞대어 볼 수 있는 항목이 없습니다.{" "}
            <Link href="/profile/me">내 정보에 스택을 더 넣으면</Link> 먼저 준비할 질문을 골라
            드립니다.
          </>
        ) : (
          <>
            요구사항 {total}개 중 <b>{fit.unmatchedCount}개</b>가 내 보유 스택과 겹치지 않습니다
            {fit.matchedCount > 0 && <> (겹치는 항목 {fit.matchedCount}개)</>}. 겹치지 않는 쪽에서
            나온 질문에 <b>우선 준비</b> 표시를 해 두었습니다.
          </>
        )}
      </p>
      {yearsNote && (
        <p style={{ margin: "8px 0 0" }} className="hint">
          {yearsNote}
        </p>
      )}
    </div>
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
