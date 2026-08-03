"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MAX_JD_LENGTH, MIN_JD_LENGTH } from "@/lib/jd/normalize";
import type { ParseJdResponse } from "@/lib/types";

export default function JdInputForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [navigating, startNavigation] = useTransition();

  const length = text.trim().length;
  const tooShort = length > 0 && length < MIN_JD_LENGTH;
  const tooLong = length > MAX_JD_LENGTH;
  const canSubmit = length >= MIN_JD_LENGTH && !tooLong && !submitting && !navigating;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/jd/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const payload: unknown = await res.json();

      if (!res.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "공고 분석에 실패했습니다.";
        setError(message);
        return;
      }

      const { jobPostingId } = payload as ParseJdResponse;
      // 파싱 결과는 서버에 있으므로 결과 페이지에서 SSR 로 다시 읽는다.
      startNavigation(() => router.push(`/result/${jobPostingId}`));
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || navigating;

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="채용공고 본문을 통째로 붙여넣으세요. 자격요건·우대사항·담당업무가 모두 들어 있을수록 질문이 정확해집니다."
          disabled={busy}
          aria-label="채용공고 본문"
        />
      </div>

      <div className="form-footer">
        <span className="counter" data-invalid={tooShort || tooLong}>
          {length.toLocaleString()}자
          {tooShort && ` — ${MIN_JD_LENGTH}자 이상 필요합니다`}
          {tooLong && ` — ${MAX_JD_LENGTH.toLocaleString()}자를 넘었습니다`}
        </span>
        <button type="submit" disabled={!canSubmit}>
          {busy ? "공고 분석 중…" : "예상 질문 만들기"}
        </button>
      </div>

      {error && (
        <div className="notice" data-tone="error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}
    </form>
  );
}
