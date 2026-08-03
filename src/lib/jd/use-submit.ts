"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { MAX_JD_LENGTH, MIN_JD_LENGTH } from "@/lib/jd/normalize";
import type { ParseJdResponse } from "@/lib/types";

/**
 * 공고 본문 → 파싱 → 결과 페이지 이동.
 *
 * /analyze 의 폼과 랜딩 히어로의 입력판이 같은 입력에 같은 반응을 해야 해서 여기로 뺐다.
 * 두 군데에 따로 두면 최소 길이 안내나 에러 문구가 조용히 어긋난다.
 */
export function useJdSubmit() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [navigating, startNavigation] = useTransition();

  const length = text.trim().length;
  const tooShort = length > 0 && length < MIN_JD_LENGTH;
  const tooLong = length > MAX_JD_LENGTH;
  const busy = submitting || navigating;
  const canSubmit = length >= MIN_JD_LENGTH && !tooLong && !busy;

  async function submit(e: FormEvent) {
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

  return { text, setText, error, length, tooShort, tooLong, busy, canSubmit, submit };
}
