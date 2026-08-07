"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StartedInterview } from "@/lib/interviews";

/**
 * 세션을 만들고 연습 화면으로 넘긴다.
 *
 * **세션을 여기서 만드는 이유**: `/interview/{sessionId}` 로 먼저 이동한 뒤 그 페이지가
 * 세션을 만들면, 사용자가 새로고침할 때마다 세션이 하나씩 더 생긴다 — 일별 상한이 순식간에
 * 닳는다. 세션 생성은 명시적인 클릭 하나에만 붙인다.
 */
export default function StartInterviewButton({
  jobPostingId,
}: {
  jobPostingId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobPostingId }),
      });
      const body = (await res.json()) as StartedInterview & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "면접 연습을 시작하지 못했습니다.");
        setPending(false);
        return;
      }
      // 세션이 이미 만들어졌으므로 뒤로 가기로 돌아와 다시 누르면 또 만들어진다.
      // replace 로 이 화면을 기록에서 치운다.
      router.replace(`/interview/${body.sessionId}`);
    } catch {
      setError("서버에 연결하지 못했습니다.");
      setPending(false);
    }
  }

  return (
    <div className="iv-start">
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() => void start()}
      >
        {pending ? "준비 중…" : "연습 시작"}
      </button>
      {error && <p className="iv-start-error">{error}</p>}
    </div>
  );
}
