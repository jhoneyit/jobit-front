"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { VideoStatus } from "@/lib/videos";

/**
 * PENDING·RUNNING 화면 — 5초 간격 폴링, 끝나면 서버 컴포넌트를 새로고침한다.
 *
 * 보고서 렌더링을 여기서 하지 않는 이유: DONE 화면은 서버 컴포넌트가 그려야 공유 링크
 * SSR(제목·설명)과 한 코드가 된다. 이 컴포넌트는 기다림만 맡는다.
 */
export default function VideoStatusPoller({
  summaryId,
  source,
}: {
  summaryId: string;
  source: "CAPTION" | "STT" | null;
}) {
  const [status, setStatus] = useState<VideoStatus>("PENDING");
  const [seconds, setSeconds] = useState(0);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/videos/status?id=${summaryId}`);
        if (!res.ok) return; // 일시 오류는 다음 폴링이 만회한다.
        const body = (await res.json()) as { status: VideoStatus };
        setStatus(body.status);
        if (body.status === "DONE" || body.status === "FAILED" || body.status === "REJECTED") {
          router.refresh();
        }
      } catch {
        // 네트워크 잠깐 끊김 — 다음 폴링에 맡긴다.
      }
    }, 5000);
    return () => {
      clearInterval(tick);
      if (timer.current) clearInterval(timer.current);
    };
  }, [summaryId, router]);

  const label =
    status === "RUNNING"
      ? source === "STT"
        ? "음성을 텍스트로 옮기는 중입니다 — 영상 길이에 따라 수십 분까지 걸립니다."
        : "요약하는 중입니다 — 자막 영상은 보통 몇 분 안에 끝납니다."
      : "대기열에 있습니다 — 앞선 요약이 끝나면 시작합니다.";

  return (
    <div className="notice" data-tone="info" role="status">
      <p style={{ margin: 0 }}>
        <b>{status === "RUNNING" ? "요약 중" : "대기 중"}</b> · {formatElapsed(seconds)} 경과
      </p>
      <p className="hint" style={{ margin: "8px 0 0" }}>
        {label} 이 페이지를 닫아도 처리는 계속되고, 주소로 다시 오면 결과가 있습니다.
      </p>
    </div>
  );
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}
