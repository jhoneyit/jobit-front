"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { VideoSummaryDetail } from "@/lib/videos";

/**
 * 3분할 작업 화면 — 좌: 플레이어 / 중: 보고서(캡처·타임스탬프) / 우: QnA 채팅.
 *
 * 타임스탬프·근거 버튼은 새 탭 대신 **왼쪽 플레이어를 시킹**한다 (enablejsapi postMessage).
 * 보고서를 읽다 그 장면을 바로 확인하는 것이 이 화면의 존재 이유다.
 */
export default function VideoWorkspace({ summary }: { summary: VideoSummaryDetail }) {
  const playerRef = useRef<HTMLIFrameElement | null>(null);
  const report = summary.report!;
  const captured = new Set(summary.capturedFrames);

  const seek = (sec: number) => {
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [sec, true] }),
      "https://www.youtube.com",
    );
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "playVideo", args: [] }),
      "https://www.youtube.com",
    );
  };

  return (
    <div className="vw-shell">
      {/* 좌: 플레이어 */}
      <div className="vw-player">
        <div className="vw-player-sticky">
          <div className="vw-video">
            <iframe
              ref={playerRef}
              src={`https://www.youtube.com/embed/${summary.videoId}?enablejsapi=1`}
              title={summary.title ?? "영상"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="vw-meta">
            <p className="sub-title" style={{ margin: 0 }}>{summary.title}</p>
            <p className="hint" style={{ margin: "6px 0 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {summary.channel && <span>{summary.channel}</span>}
              <span className="vw-source" data-source={summary.source ?? "CAPTION"}>
                {summary.source === "STT" ? "음성 인식" : "자막"}
              </span>
              <a href={summary.url} target="_blank" rel="noreferrer">유튜브에서 열기 ↗</a>
            </p>
            <p className="hint" style={{ margin: "10px 0 0" }}>
              <Link href="/videos" className="cta">← 영상 요약</Link>
              {" · "}
              <Link href="/videos/history" className="cta">요약 기록</Link>
            </p>
          </div>
        </div>
      </div>

      {/* 중: 보고서 */}
      <div className="vw-report">
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{report.oneLine}</p>
          <p style={{ margin: "10px 0 0" }}>{report.overview}</p>
        </div>

        <div className="section-head">
          <h2>구간별 정리</h2>
          <span className="hint">시각을 누르면 왼쪽 플레이어가 이동합니다</span>
        </div>
        <ul className="sub-list">
          {report.sections.map((section, i) => (
            <li key={i} className="sub-item" style={{ flexDirection: "column", alignItems: "stretch" }}>
              {section.startSec != null && captured.has(section.startSec) && (
                <button
                  type="button"
                  className="vw-frame"
                  onClick={() => seek(section.startSec!)}
                  aria-label={`${formatTimestamp(section.startSec)} 장면으로 이동`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/videos/frame?id=${summary.summaryId}&t=${section.startSec}`}
                    alt=""
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </button>
              )}
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                {section.startSec != null && (
                  <button type="button" className="vw-tchip" onClick={() => seek(section.startSec!)}>
                    ▶ {formatTimestamp(section.startSec)}
                  </button>
                )}
                <span className="sub-title">{section.heading}</span>
              </div>
              <p style={{ margin: "6px 0 0" }}>{section.summary}</p>
            </li>
          ))}
        </ul>

        <div className="section-head" style={{ marginTop: 24 }}>
          <h2>핵심 정리</h2>
        </div>
        <div className="card">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {report.takeaways.map((takeaway, i) => (
              <li key={i} style={{ margin: "6px 0" }}>{takeaway}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* 우: QnA */}
      <div className="vw-chat">
        <QnaPanel summaryId={summary.summaryId} onSeek={seek} />
      </div>
    </div>
  );
}

interface Turn {
  role: "user" | "assistant";
  text: string;
  refs?: number[];
  error?: boolean;
}

/**
 * 영상 내용 QnA — 답의 근거 [t=초] 버튼도 플레이어를 시킹한다.
 *
 * 대화는 이 화면의 상태뿐이다 (서버는 저장하지 않는다) — 새로고침하면 사라지는 것이 규약이고,
 * 요청마다 직전 6턴만 맥락으로 보낸다.
 */
function QnaPanel({ summaryId, onSeek }: { summaryId: string; onSeek: (sec: number) => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 스트리밍 중인 마지막 답변 턴을 바꿔 끼운다 — 델타마다 텍스트가 자란다.
  const patchLast = (patch: (last: Turn) => Turn) =>
    setTurns((prev) => [...prev.slice(0, -1), patch(prev[prev.length - 1])]);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || pending) return;
    setInput("");
    setPending(true);
    const history = turns.slice(-6).map((t) => `${t.role === "user" ? "질문" : "답변"}: ${t.text}`);
    setTurns((prev) => [...prev, { role: "user", text: question }]);
    let streaming = false; // 답변 턴을 이미 추가했는가 — 오류를 어디에 쓸지 가른다
    try {
      const res = await fetch("/api/videos/qna", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summaryId, question, history }),
      });
      // 스트림을 열기 전의 실패(검증·한도)는 JSON 으로 온다 — content-type 이 갈림길이다.
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setTurns((prev) => [...prev,
          { role: "assistant", text: body.error ?? "답변을 받지 못했습니다.", error: true }]);
        return;
      }
      setTurns((prev) => [...prev, { role: "assistant", text: "" }]);
      streaming = true;
      for await (const { name, data } of sseFrames(res.body!)) {
        if (name === "delta") {
          const piece = String((data as { text?: string }).text ?? "");
          patchLast((last) => ({ ...last, text: last.text + piece }));
        } else if (name === "done") {
          // 최종본으로 교체 — 서버가 refs 를 재검증한 뒤의 정본이다.
          const final = data as { answer?: string; refs?: number[] };
          patchLast((last) => ({
            role: "assistant", text: final.answer ?? last.text, refs: final.refs ?? [],
          }));
        } else if (name === "error") {
          const message = String((data as { message?: string }).message ?? "답변을 받지 못했습니다.");
          patchLast(() => ({ role: "assistant", text: message, error: true }));
        }
      }
      // done 도 error 도 없이 스트림이 닫힌 경우 — 빈 턴을 오류로 바꾼다.
      patchLast((last) => last.text || last.error != null || last.refs != null ? last
        : { role: "assistant", text: "답변이 중단됐습니다. 다시 시도해 주세요.", error: true });
    } catch {
      const message = "답변을 받지 못했습니다. 잠시 후 다시 시도해 주세요.";
      if (streaming) patchLast(() => ({ role: "assistant", text: message, error: true }));
      else setTurns((prev) => [...prev, { role: "assistant", text: message, error: true }]);
    } finally {
      setPending(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50);
    }
  };

  return (
    <div className="vw-chat-panel">
      <div className="section-head" style={{ marginBottom: 8 }}>
        <h2>영상에 질문하기</h2>
      </div>
      <div className="vw-chat-log" ref={scrollRef}>
        {turns.length === 0 && (
          <p className="hint" style={{ margin: 0 }}>
            영상 내용에 대해 물어보세요. 답변에는 근거 장면으로 가는 버튼이 붙습니다.
            <br />예: &ldquo;면접 준비는 언제 시작하라고 했어?&rdquo;
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="vw-msg" data-role={turn.role} data-error={turn.error || undefined}>
            <p style={{ margin: 0 }}>{turn.text}</p>
            {turn.refs && turn.refs.length > 0 && (
              <div className="chips" style={{ marginTop: 6 }}>
                {turn.refs.map((sec) => (
                  <button key={sec} type="button" className="vw-tchip" onClick={() => onSeek(sec)}>
                    ▶ {formatTimestamp(sec)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {/* 첫 델타가 오면 답변 턴 자체가 자라므로 점은 그때까지만 보인다 */}
        {pending && !(turns[turns.length - 1]?.role === "assistant" && turns[turns.length - 1].text) && (
          <div className="streaming" role="status">
            <span className="dot" /> 답변을 만드는 중…
          </div>
        )}
      </div>
      <form className="vw-chat-input" onSubmit={ask}>
        <input
          type="text"
          className="vw-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="영상 내용에 대해 질문"
          aria-label="영상에 질문"
          disabled={pending}
          maxLength={500}
        />
        <button type="submit" disabled={pending || !input.trim()}>
          질문
        </button>
      </form>
    </div>
  );
}

/**
 * SSE 바이트 스트림 → {이벤트 이름, data JSON} 시퀀스.
 *
 * 프레임은 빈 줄로 구분되고 네트워크 조각은 그 경계를 무시하고 잘려 온다 — 버퍼에 모아
 * `\n\n` 단위로만 꺼낸다 (questions 라우트와 같은 이유). 파싱 안 되는 프레임은 버린다.
 */
async function* sseFrames(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf("\n\n");
    while (sep >= 0) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf("\n\n");
      let name = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;
      try {
        yield { name, data: JSON.parse(dataLines.join("\n")) as unknown };
      } catch {
        // 반쪽 프레임이 아니라 진짜 깨진 데이터다 — 건너뛴다.
      }
    }
  }
}

function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
