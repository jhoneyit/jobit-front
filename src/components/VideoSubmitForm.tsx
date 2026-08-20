"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * 유튜브 URL 입력 → 접수 → 보고서 페이지로 이동.
 *
 * 접수는 즉시 돌아온다 (처리는 서버 워커가 한다) — 이미 요약된 영상이면 이동한 페이지에
 * 보고서가 바로 떠 있고, 아니면 그 페이지가 폴링한다.
 */
export default function VideoSubmitForm() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/videos/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await res.json()) as { summaryId?: string; error?: string };
      if (!res.ok || !body.summaryId) {
        setError(body.error ?? "요약을 접수하지 못했습니다.");
        return;
      }
      router.push(`/videos/${body.summaryId}`);
    } catch {
      setError("요약을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          aria-label="유튜브 영상 주소"
          disabled={pending}
          style={{ flex: 1, minWidth: 240 }}
        />
        <button type="submit" className="cta" disabled={pending || !url.trim()}>
          {pending ? "접수 중…" : "요약하기"}
        </button>
      </div>
      {error && (
        <div className="notice" data-tone="warn" style={{ marginTop: 12 }} role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
