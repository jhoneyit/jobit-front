import type { Metadata } from "next";
import Link from "next/link";
import { FEATURE_LABEL, fmtInt, fmtUsd } from "@/lib/admin/format";
import { getOverview } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "대시보드" };

export default async function AdminDashboardPage() {
  const o = await getOverview();

  const stats = [
    { label: "가입 사용자", value: fmtInt(o.users) },
    { label: "공고", value: fmtInt(o.postings) },
    {
      label: "제출 이력",
      value: fmtInt(o.submissions),
      hint: `익명 ${fmtInt(o.anonSubmissions)}건 포함`,
    },
    { label: "질문 세트", value: fmtInt(o.questionSets) },
    { label: "LLM 호출", value: fmtInt(o.totalCalls), hint: `캐시 적중 ${fmtInt(o.cacheHits)}건` },
    {
      label: "누적 비용",
      value: fmtUsd(o.totalCostUsd),
      hint: `in ${fmtInt(o.totalInputTokens)} / out ${fmtInt(o.totalOutputTokens)} 토큰`,
    },
  ];

  return (
    <>
      <header className="adm-head">
        <h1>대시보드</h1>
        <p>서비스 전체 현황입니다.</p>
      </header>

      <div className="adm-stats">
        {stats.map((s) => (
          <div key={s.label} className="adm-stat">
            <span className="adm-stat-label">{s.label}</span>
            <strong className="adm-stat-value">{s.value}</strong>
            {s.hint && <span className="adm-stat-hint">{s.hint}</span>}
          </div>
        ))}
      </div>

      <section className="adm-section">
        <div className="adm-section-head">
          <h2>기능별 비용</h2>
          <Link href="/admin/usage" className="adm-link">
            토큰 사용량 자세히 →
          </Link>
        </div>

        {o.byFeature.length === 0 ? (
          <p className="adm-empty">아직 LLM 호출 기록이 없습니다.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>기능</th>
                  <th className="num">호출</th>
                  <th className="num">입력 토큰</th>
                  <th className="num">출력 토큰</th>
                  <th className="num">비용</th>
                </tr>
              </thead>
              <tbody>
                {o.byFeature.map((f) => (
                  <tr key={f.feature}>
                    <td>{FEATURE_LABEL[f.feature] ?? f.feature}</td>
                    <td className="num">{fmtInt(f.calls)}</td>
                    <td className="num">{fmtInt(f.inputTokens)}</td>
                    <td className="num">{fmtInt(f.outputTokens)}</td>
                    <td className="num">{fmtUsd(f.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
