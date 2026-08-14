"use client";

import { useState } from "react";
import Link from "next/link";
import type { GapAnalysis, GapItem, RewriteSuggestion } from "@/lib/gap";

/**
 * 이력서 갭 분석 (스펙 §4.5) — 결과 화면의 한 섹션.
 *
 * **갭 분석 표가 첨삭보다 먼저다** (§4.5 "쓸모있다고 느끼는 지점"). 표의 세 상태는 스펙 어휘
 * 그대로다: ✅ 충족 / ⚠️ 약함 / ❌ 없음. MISSING 은 **지어내지 않고** 질문 생성으로 넘긴다 —
 * 이 화면 아래가 바로 예상 질문이라 흐름이 자연히 닫힌다.
 *
 * 분석 시작은 명시적인 버튼이다. 서버 컴포넌트가 캐시된 결과(GET)를 초기값으로 내려주므로,
 * 재방문은 클릭 없이 표가 바로 뜬다.
 */

interface GapResume {
  resumeId: string;
  bulletCount: number;
}

export default function GapSection({
  jobPostingId,
  resume,
  initial,
}: {
  jobPostingId: string;
  /** 가장 최근 이력서. 없으면 업로드 유도 — `gapSummary` 와 같은 "최근 하나" 규약이다 */
  resume: GapResume | null;
  initial: GapAnalysis | null;
}) {
  const [analysis, setAnalysis] = useState<GapAnalysis | null>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!resume) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/gap/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumeId: resume.resumeId, jobPostingId }),
      });
      const body = (await res.json()) as GapAnalysis & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "갭 분석에 실패했습니다.");
        return;
      }
      setAnalysis(body);
    } catch {
      // 판정이 요구사항 수만큼 돌아 프록시 타임아웃에 걸릴 수 있다. 백엔드는 계속 돌아
      // 캐시에 저장되므로, 같은 버튼이 재시도 겸 결과 불러오기가 된다.
      setError(
        "분석이 오래 걸리고 있습니다. 백엔드에서 계속 진행 중이니 잠시 후 다시 눌러 주세요.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="section">
      <div className="section-head">
        <h2>이력서 갭 분석</h2>
        <span className="hint">요구사항마다 내 이력서에 근거가 있는지</span>
      </div>

      {!resume ? (
        <div className="notice" data-tone="info">
          이력서를 올리면 요구사항마다 충족 여부를 판정해 드립니다.{" "}
          <Link href="/profile/resumes">이력서 올리러 가기 →</Link>
        </div>
      ) : !analysis ? (
        <div className="card">
          <p style={{ margin: "0 0 12px" }}>
            가장 최근에 올린 이력서(문장 {resume.bulletCount}개)로 요구사항을 하나씩
            판정합니다. <b>몇 분 걸립니다.</b>
          </p>
          <button type="button" className="cta" onClick={analyze} disabled={pending}>
            {pending ? "분석 중… (요구사항마다 판정합니다)" : "갭 분석 시작"}
          </button>
          {error && (
            <div className="notice" data-tone="warn" style={{ marginTop: 12 }} role="alert">
              {error}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="notice" data-tone="info" style={{ marginBottom: 16 }}>
            충족 <b>{analysis.summary.met}</b> · 약함 <b>{analysis.summary.weak}</b> · 없음{" "}
            <b>{analysis.summary.missing}</b>
            {analysis.summary.missing > 0 && (
              <>
                {" "}
                — 없음 항목은 지어내는 대신 <a href="#questions">예상 질문</a>으로
                준비합니다.
              </>
            )}
          </div>
          <ul className="sub-list">
            {analysis.items.map((item) => (
              <GapRow key={item.gapItemId} item={item} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

const STATUS_LABEL: Record<GapItem["status"], string> = {
  MET: "✅ 충족",
  WEAK: "⚠️ 약함",
  MISSING: "❌ 없음",
};

function GapRow({ item }: { item: GapItem }) {
  return (
    <li className="sub-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ whiteSpace: "nowrap" }}>{STATUS_LABEL[item.status]}</span>
        <span className="sub-title" style={{ flex: 1, minWidth: 200 }}>
          {item.requirementText}
        </span>
      </div>

      {item.evidence && (
        <p className="hint" style={{ margin: "6px 0 0" }}>
          근거: “{item.evidence.text}”
        </p>
      )}
      <p className="hint" style={{ margin: "4px 0 0" }}>
        {item.rationale}
      </p>

      {item.status === "WEAK" && <RewritePanel gapItemId={item.gapItemId} />}
      {item.status === "MISSING" && (
        <p className="hint" style={{ margin: "6px 0 0" }}>
          충족 근거가 없습니다. 면접에서 물어볼 가능성이 높으니{" "}
          <a href="#questions">예상 질문</a>의 인접 경험으로 준비해 두세요.
        </p>
      )}
    </li>
  );
}

/**
 * WEAK 행의 수정안 (스펙 §4.5) — 원문 옆에 수정안을 나란히 + 왜 고쳤는지 한 줄.
 *
 * **대괄호는 지원자가 채울 자리 표시다.** 모델이 숫자를 지어내는 대신 남긴 빈칸이라
 * (`jobit/docs/api.md` "리라이트"), 눈에 띄게 표시해 입력을 유도한다.
 */
function RewritePanel({ gapItemId }: { gapItemId: string }) {
  const [suggestion, setSuggestion] = useState<RewriteSuggestion | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/gap/rewrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gapItemId }),
      });
      const body = (await res.json()) as RewriteSuggestion & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "수정안을 만들지 못했습니다.");
        return;
      }
      setSuggestion(body);
    } catch {
      setError("수정안 생성이 오래 걸리고 있습니다. 잠시 후 다시 눌러 주세요.");
    } finally {
      setPending(false);
    }
  };

  const toggleAccepted = async () => {
    if (!suggestion) return;
    const next = !suggestion.accepted;
    // 낙관적 갱신 — 실패하면 되돌린다. 채택은 표시일 뿐이라 잠깐의 어긋남이 해가 없다.
    setSuggestion({ ...suggestion, accepted: next });
    try {
      const res = await fetch("/api/gap/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ suggestionId: suggestion.suggestionId, accepted: next }),
      });
      if (!res.ok) setSuggestion({ ...suggestion, accepted: !next });
    } catch {
      setSuggestion({ ...suggestion, accepted: !next });
    }
  };

  if (!suggestion) {
    return (
      <div style={{ marginTop: 10 }}>
        <button type="button" className="chip" onClick={load} disabled={pending}>
          {pending ? "수정안 만드는 중… (수십 초)" : "이 문장 고쳐 쓰기 →"}
        </button>
        {error && (
          <div className="notice" data-tone="warn" style={{ marginTop: 8 }} role="alert">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <p className="hint" style={{ margin: 0 }}>
        원문
      </p>
      <p style={{ margin: "4px 0 10px" }}>{suggestion.original}</p>
      <p className="hint" style={{ margin: 0 }}>
        수정안 — <mark>대괄호</mark>는 실제 수치로 채워 넣을 자리입니다
      </p>
      <p style={{ margin: "4px 0 10px" }}>
        <SuggestedText text={suggestion.suggested} />
      </p>
      <p className="hint" style={{ margin: "0 0 10px" }}>
        {suggestion.reason}
      </p>
      <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={suggestion.accepted}
          onChange={() => void toggleAccepted()}
        />
        내 이력서에 반영했어요
      </label>
    </div>
  );
}

/** `[자리 표시]` 를 시각적으로 구분한다 — 그대로 복사해 내는 실수를 줄인다. */
function SuggestedText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]*\])/).map((part, i) =>
        part.startsWith("[") && part.endsWith("]") ? (
          <mark key={i}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
