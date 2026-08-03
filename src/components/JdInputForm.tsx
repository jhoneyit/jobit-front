"use client";

import { MAX_JD_LENGTH, MIN_JD_LENGTH } from "@/lib/jd/normalize";
import { useJdSubmit } from "@/lib/jd/use-submit";

export default function JdInputForm() {
  const jd = useJdSubmit();

  return (
    <form onSubmit={jd.submit}>
      <div className="field">
        <textarea
          value={jd.text}
          onChange={(e) => jd.setText(e.target.value)}
          placeholder="채용공고 본문을 통째로 붙여넣으세요. 자격요건·우대사항·담당업무가 모두 들어 있을수록 질문이 정확해집니다."
          disabled={jd.busy}
          aria-label="채용공고 본문"
        />
      </div>

      <div className="form-footer">
        <span className="counter" data-invalid={jd.tooShort || jd.tooLong}>
          {jd.length.toLocaleString()}자
          {jd.tooShort && ` — ${MIN_JD_LENGTH}자 이상 필요합니다`}
          {jd.tooLong && ` — ${MAX_JD_LENGTH.toLocaleString()}자를 넘었습니다`}
        </span>
        <button type="submit" disabled={!jd.canSubmit}>
          {jd.busy ? "공고 분석 중…" : "예상 질문 만들기"}
        </button>
      </div>

      {jd.error && (
        <div className="notice" data-tone="error" role="alert" style={{ marginTop: 16 }}>
          {jd.error}
        </div>
      )}
    </form>
  );
}
