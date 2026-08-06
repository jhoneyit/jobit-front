import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import SubmissionRow from "@/components/SubmissionRow";
import { claimAnonymousHistory } from "@/lib/claim";
import { currentOwner } from "@/lib/owner";
import { listSubmissions } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 기록",
  // 개인 기록이므로 검색엔진에 올리지 않는다 (공유 링크와 다른 성격)
  robots: { index: false, follow: false },
};

export default async function HistoryPage() {
  const session = await auth();

  // 로그인 직후라면 익명으로 쌓아 둔 기록을 계정으로 승계한다.
  let claimed = 0;
  if (session?.user?.id) {
    claimed = await claimAnonymousHistory(session.user.id);
  }

  const owner = await currentOwner();
  const submissions = owner ? await listSubmissions(owner.key) : [];

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>내 기록</h1>
        <p>
          {owner?.isLoggedIn
            ? "계정에 저장된 공고입니다. 어느 기기에서 로그인하든 그대로 보입니다."
            : "이 브라우저에 저장된 공고입니다. 로그인하면 계정으로 옮겨져 다른 기기에서도 보입니다."}
        </p>
      </section>

      {claimed > 0 && (
        <div className="notice" data-tone="info" style={{ marginBottom: 20 }}>
          로그인 전에 만든 기록 {claimed}건을 계정으로 옮겼습니다.
        </div>
      )}

      {!owner?.isLoggedIn && submissions.length > 0 && (
        <div className="notice" data-tone="warn" style={{ marginBottom: 20 }}>
          아직 로그인하지 않으셨습니다. 브라우저 데이터를 지우면 이 목록도 사라집니다.{" "}
          <Link href="/signin?callbackUrl=/profile/history">로그인하고 계정에 저장하기 →</Link>
        </div>
      )}

      {submissions.length === 0 ? (
        <div className="empty">
          <p style={{ margin: "0 0 14px" }}>아직 넣은 공고가 없습니다.</p>
          <Link href="/analyze" className="cta">
            공고 붙여넣기 →
          </Link>
        </div>
      ) : (
        <section className="section" style={{ marginTop: 0 }}>
          <div className="section-head">
            <h2>공고 {submissions.length}건</h2>
            <span className="hint">최근에 넣은 순</span>
          </div>
          <ul className="sub-list">
            {submissions.map((s) => (
              <SubmissionRow key={s.jobPostingId} item={s} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
