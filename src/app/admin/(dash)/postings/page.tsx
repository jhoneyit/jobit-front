import type { Metadata } from "next";
import Link from "next/link";
import { fmtDateTime, fmtInt } from "@/lib/admin/format";
import { listPostings } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "공고" };

export default async function AdminPostingsPage() {
  const rows = await listPostings();

  return (
    <>
      <header className="adm-head">
        <h1>공고</h1>
        <p>
          공고는 <code>content_hash</code> 로 중복 제거되어 전역에 하나씩만 존재합니다 — 같은
          공고를 여러 명이 넣어도 한 줄입니다.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="adm-empty">아직 등록된 공고가 없습니다.</p>
      ) : (
        <>
          <p className="adm-count">총 {fmtInt(rows.length)}건 · 최근순</p>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>공고</th>
                  <th className="num">요구사항</th>
                  <th className="num">제출</th>
                  <th>등록 시각</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/admin/postings/${r.id}`} className="adm-link">
                        {r.title || "(제목 없음)"}
                      </Link>
                      <span className="adm-sub">{r.company || "회사 미상"}</span>
                    </td>
                    <td className="num">{fmtInt(r.requirementCount)}</td>
                    <td className="num">{fmtInt(r.submissionCount)}</td>
                    <td className="adm-nowrap">{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
