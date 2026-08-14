import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import DeleteResumeButton from "@/components/DeleteResumeButton";
import ResumeUploadForm from "@/components/ResumeUploadForm";
import { claimAnonymousResumes } from "@/lib/claim";
import { currentOwner } from "@/lib/owner";
import { listResumes, type ResumeSummary } from "@/lib/resumes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 이력서",
  // 개인 기록이므로 검색엔진에 올리지 않는다 (내 기록과 같은 성격)
  robots: { index: false, follow: false },
};

/**
 * 이력서 목록 + 업로드 (스펙 §3.3, 갭 분석의 입구).
 *
 * **원문은 이 화면에 없다.** 백엔드가 원문을 어느 응답에도 싣지 않는다 (`jobit/docs/api.md`
 * "이력서") — 목록은 문장 수와 보관 기한만 보여주고, 내용 확인은 분해된 문장 목록으로 한다.
 */
export default async function ResumesPage() {
  const session = await auth();

  // 로그인 직후라면 익명으로 올린 이력서를 계정으로 승계한다.
  let claimed = 0;
  if (session?.user?.id) {
    claimed = await claimAnonymousResumes(session.user.id);
  }

  const owner = await currentOwner();

  let resumes: ResumeSummary[] = [];
  let loadFailed = false;
  if (owner) {
    try {
      resumes = await listResumes(owner.key);
    } catch (err) {
      console.error("[resumes] 목록을 불러오지 못했습니다:", err);
      loadFailed = true;
    }
  }

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>내 이력서</h1>
        <p>
          이력서를 올리면 문장 단위로 분해해, 공고 요구사항과 맞대어 보는{" "}
          <b>갭 분석</b>에 씁니다. 원문은 암호화되어 저장되고 90일 뒤 자동 삭제됩니다.
        </p>
      </section>

      {claimed > 0 && (
        <div className="notice" data-tone="info" style={{ marginBottom: 20 }}>
          로그인 전에 올린 이력서 {claimed}건을 계정으로 옮겼습니다.
        </div>
      )}

      <section className="section" style={{ marginTop: 0 }}>
        <div className="section-head">
          <h2>새 이력서 올리기</h2>
          <span className="hint">파일이 아니라 본문 텍스트를 붙여넣습니다</span>
        </div>
        <ResumeUploadForm hasOwner={owner != null} />
      </section>

      {loadFailed ? (
        <div className="notice" data-tone="warn">
          이력서 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
        </div>
      ) : resumes.length > 0 ? (
        <section className="section">
          <div className="section-head">
            <h2>올린 이력서 {resumes.length}건</h2>
            <span className="hint">
              수정하려면 고친 본문을 새로 올립니다 — 갭 분석은 새 이력서 기준으로 다시 돕니다
            </span>
          </div>
          <ul className="sub-list">
            {resumes.map((r) => (
              <li key={r.resumeId} className="sub-item">
                <div className="sub-main">
                  <p className="sub-title" style={{ margin: 0 }}>
                    문장 {r.bulletCount}개로 분해됨
                  </p>
                  <p className="sub-meta">
                    <time dateTime={r.createdAt}>{formatDate(r.createdAt)} 업로드</time>
                    <span aria-hidden="true">·</span>
                    <time dateTime={r.expiresAt}>{formatDate(r.expiresAt)} 까지 보관</time>
                  </p>
                </div>
                <DeleteResumeButton
                  resumeId={r.resumeId}
                  label={`${formatDate(r.createdAt)} 업로드한 이력서`}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="footnote">
        올린 이력서는 <Link href="/profile/history">내 기록</Link>의 공고 결과 화면에서 갭
        분석에 쓰입니다. 삭제하면 분해된 문장과 갭 분석 결과도 함께 사라집니다.
      </p>
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
