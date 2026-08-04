import type { Metadata } from "next";
import { FEATURE_LABEL, fmtDateTime, fmtInt, fmtUsd } from "@/lib/admin/format";
import { getUsage } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "토큰 사용량" };

export default async function AdminUsagePage() {
  const u = await getUsage();

  // 막대 길이 기준. 0 으로 나누지 않도록 최소 1.
  const maxDayCost = Math.max(1e-9, ...u.byDay.map((d) => d.costUsd));

  return (
    <>
      <header className="adm-head">
        <h1>토큰 사용량</h1>
        <p>
          Anthropic 호출 기록(<code>llm_call_log</code>)입니다. 비용은 호출 시점의 단가표로
          계산해 저장된 값입니다.
        </p>
      </header>

      {u.recent.length === 0 ? (
        <p className="adm-empty">아직 LLM 호출 기록이 없습니다.</p>
      ) : (
        <>
          <section className="adm-section">
            <h2>모델별</h2>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>모델</th>
                    <th className="num">호출</th>
                    <th className="num">입력 토큰</th>
                    <th className="num">출력 토큰</th>
                    <th className="num">비용</th>
                  </tr>
                </thead>
                <tbody>
                  {u.byModel.map((m) => (
                    <tr key={m.model}>
                      <td>{m.model}</td>
                      <td className="num">{fmtInt(m.calls)}</td>
                      <td className="num">{fmtInt(m.inputTokens)}</td>
                      <td className="num">{fmtInt(m.outputTokens)}</td>
                      <td className="num">{fmtUsd(m.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="adm-section">
            <h2>일별 (최근 30일)</h2>
            <ul className="adm-bars">
              {u.byDay.map((d) => (
                <li key={d.day}>
                  <span className="adm-bar-day">{d.day}</span>
                  <span className="adm-bar-track">
                    <span
                      className="adm-bar-fill"
                      style={{ width: `${Math.max(2, (d.costUsd / maxDayCost) * 100)}%` }}
                    />
                  </span>
                  <span className="adm-bar-val">
                    {fmtUsd(d.costUsd)}
                    <span className="adm-dim">
                      {" "}
                      · {fmtInt(d.calls)}회 · in {fmtInt(d.inputTokens)} / out{" "}
                      {fmtInt(d.outputTokens)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="adm-section">
            <h2>최근 호출 {fmtInt(u.recent.length)}건</h2>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>시각</th>
                    <th>기능</th>
                    <th>모델</th>
                    <th className="num">입력</th>
                    <th className="num">출력</th>
                    <th className="num">캐시 R/W</th>
                    <th className="num">지연</th>
                    <th className="num">비용</th>
                  </tr>
                </thead>
                <tbody>
                  {u.recent.map((r) => (
                    <tr key={r.id}>
                      <td className="adm-nowrap">{fmtDateTime(r.createdAt)}</td>
                      <td>
                        {FEATURE_LABEL[r.feature] ?? r.feature}
                        {r.cacheHit && <span className="adm-hit">HIT</span>}
                      </td>
                      <td className="adm-nowrap">{r.model}</td>
                      <td className="num">{fmtInt(r.inputTokens)}</td>
                      <td className="num">{fmtInt(r.outputTokens)}</td>
                      <td className="num adm-dim">
                        {fmtInt(r.cacheReadTokens)}/{fmtInt(r.cacheCreationTokens)}
                      </td>
                      <td className="num adm-dim">{fmtInt(r.latencyMs)}ms</td>
                      <td className="num">{fmtUsd(r.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
