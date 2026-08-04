import type { Metadata } from "next";
import Link from "next/link";
import { fmtDateTime, fmtInt, shortOwner } from "@/lib/admin/format";
import { listSubmissions } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "제출 이력" };

export default async function AdminSubmissionsPage() {
  const rows = await listSubmissions();

  return (
    <>
      <header className="adm-head">
        <h1>제출 이력</h1>
        <p>누가 어떤 공고를 넣었는지, 그 공고에서 질문이 나왔는지 보여줍니다.</p>
      </header>

      {rows.length === 0 ? (
        <p className="adm-empty">아직 제출된 공고가 없습니다.</p>
      ) : (
        <>
          <p className="adm-count">총 {fmtInt(rows.length)}건 · 최근순</p>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>제출자</th>
                  <th>공고</th>
                  <th className="num">요구사항</th>
                  <th className="num">질문</th>
                  <th>제출 시각</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const anon = r.ownerKey.startsWith("anon:");
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="adm-owner">
                          {r.userName || r.userEmail || (anon ? "익명" : "(삭제된 사용자)")}
                        </span>
                        <span className="adm-owner-key" title={r.ownerKey}>
                          {shortOwner(r.ownerKey)}
                        </span>
                      </td>
                      <td>
                        <Link href={`/admin/postings/${r.jobPostingId}`} className="adm-link">
                          {r.title || "(제목 없음)"}
                        </Link>
                        <span className="adm-sub">{r.company || "회사 미상"}</span>
                      </td>
                      <td className="num">{fmtInt(r.requirementCount)}</td>
                      <td className="num">
                        {r.questionCount > 0 ? (
                          fmtInt(r.questionCount)
                        ) : (
                          <span className="adm-dim">—</span>
                        )}
                      </td>
                      <td className="adm-nowrap">{fmtDateTime(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
