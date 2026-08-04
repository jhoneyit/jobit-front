import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KIND_LABEL, fmtDateTime, fmtInt, shortOwner } from "@/lib/admin/format";
import { getPostingDetail } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "공고 상세" };

export default async function AdminPostingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getPostingDetail(id);
  if (!p) notFound();

  const years = p.parsed?.yearsOfExperience;

  return (
    <>
      <header className="adm-head">
        <Link href="/admin/submissions" className="adm-back">
          ← 제출 이력
        </Link>
        <h1>{p.title || "(제목 없음)"}</h1>
        <p>
          {p.company || "회사 미상"} · 등록 {fmtDateTime(p.createdAt)}
        </p>
      </header>

      <section className="adm-section">
        <h2>파싱 결과</h2>
        <dl className="adm-meta">
          <div>
            <dt>도메인</dt>
            <dd>{p.parsed?.domain || <span className="adm-dim">—</span>}</dd>
          </div>
          <div>
            <dt>요구 연차</dt>
            <dd>
              {years
                ? `${years.min ?? "?"}년${years.max ? ` ~ ${years.max}년` : " 이상"}`
                : <span className="adm-dim">—</span>}
            </dd>
          </div>
          <div>
            <dt>기술 스택</dt>
            <dd>
              {p.parsed?.stack?.length ? (
                <span className="adm-tags">
                  {p.parsed.stack.map((s) => (
                    <span key={s} className="adm-tag">
                      {s}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="adm-dim">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt>키워드</dt>
            <dd>
              {p.parsed?.keywords?.length ? (
                <span className="adm-tags">
                  {p.parsed.keywords.map((k) => (
                    <span key={k} className="adm-tag">
                      {k}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="adm-dim">—</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="adm-section">
        <h2>제출자 {fmtInt(p.submitters.length)}명</h2>
        <ul className="adm-list">
          {p.submitters.map((s) => (
            <li key={`${s.ownerKey}-${s.at}`}>
              <span className="adm-owner">
                {s.userName || s.userEmail || (s.ownerKey.startsWith("anon:") ? "익명" : "—")}
              </span>
              <span className="adm-owner-key" title={s.ownerKey}>
                {shortOwner(s.ownerKey)}
              </span>
              <span className="adm-dim">{fmtDateTime(s.at)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="adm-section">
        <h2>요구사항 {fmtInt(p.requirements.length)}개</h2>
        <ul className="adm-req">
          {p.requirements.map((r) => (
            <li key={r.id}>
              <span className="adm-kind" data-kind={r.kind}>
                {KIND_LABEL[r.kind] ?? r.kind}
              </span>
              <span className="adm-req-text">{r.text}</span>
              {r.keywords.length > 0 && (
                <span className="adm-tags">
                  {r.keywords.map((k) => (
                    <span key={k} className="adm-tag">
                      {k}
                    </span>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="adm-section">
        <h2>생성된 질문</h2>
        {p.questionSets.length === 0 ? (
          <p className="adm-empty">아직 이 공고로 질문을 생성하지 않았습니다.</p>
        ) : (
          p.questionSets.map((set) => (
            <div key={set.id} className="adm-qset">
              <div className="adm-qset-head">
                <strong>{set.model}</strong>
                <span className="adm-dim">
                  프롬프트 {set.promptVersion} · {fmtDateTime(set.createdAt)} · 질문{" "}
                  {fmtInt(set.questions.length)}개
                </span>
              </div>
              <ol className="adm-qlist">
                {set.questions.map((q) => (
                  <li key={q.id}>
                    <div className="adm-q-top">
                      <span className="adm-tag">{q.category}</span>
                      <span className="adm-dim">난이도 {q.difficulty}</span>
                    </div>
                    <p className="adm-q-text">{q.text}</p>
                    {q.answerOutline.length > 0 && (
                      <ul className="adm-q-outline">
                        {q.answerOutline.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    )}
                    {q.followups.length > 0 && (
                      <p className="adm-q-follow">꼬리질문: {q.followups.join(" / ")}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </section>

      <section className="adm-section">
        <h2>원문</h2>
        <details className="adm-details">
          <summary>공고 원문 보기 ({fmtInt(p.rawText.length)}자)</summary>
          <pre className="adm-raw">{p.rawText}</pre>
        </details>
      </section>
    </>
  );
}
