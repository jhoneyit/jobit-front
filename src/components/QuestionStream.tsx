"use client";

import { useEffect, useRef, useState } from "react";
import QuestionCard from "@/components/QuestionCard";
import { questionPriority } from "@/lib/profile/match";
import type { RequirementFit } from "@/lib/profile/types";
import type { Question, QuestionStreamEvent, Requirement } from "@/lib/types";

type Status = "streaming" | "done" | "error";

/**
 * /api/questions 의 SSE 를 읽어 질문이 도착하는 대로 화면에 쌓는다 (스펙 §6).
 *
 * EventSource 대신 fetch + ReadableStream 을 쓰는 이유:
 *  - EventSource 는 스트림이 정상 종료돼도 자동 재연결한다 → LLM 을 다시 부르게 된다.
 *  - 429/500 응답의 본문을 읽을 수 없어서 사용자에게 이유를 보여줄 수 없다.
 */
export default function QuestionStream({
  jobPostingId,
  requirements,
  fits,
}: {
  jobPostingId: string;
  requirements: Requirement[];
  /** 요구사항 id → 내 보유 스택과의 관계. 프로필이 없으면 undefined. */
  fits?: Record<string, RequirementFit>;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState<Status>("streaming");
  const [error, setError] = useState<string | null>(null);
  const [expected, setExpected] = useState(10);
  const [sorted, setSorted] = useState(false);

  /**
   * StrictMode 가 effect 를 두 번 돌려도 요청을 두 번 보내지 않게 막는다.
   *
   * **cleanup 에서 반드시 풀어야 한다.** 개발 모드의 StrictMode 는
   * `실행 → cleanup → 재실행` 순으로 도는데, ref 가 그대로 남아 있으면 재실행이 이 가드에
   * 걸려 조기 반환하고, 그 사이 cleanup 이 첫 요청을 abort 해 버려 **살아 있는 요청이 하나도
   * 남지 않는다.** 화면은 "질문을 만들고 있습니다…"에서 멈추는데 서버는 생성을 마치고 저장하므로,
   * 새로고침하면 캐시로 한꺼번에 뜬다 — 스트리밍이 안 되는 것처럼 보이는 정체가 이것이다.
   */
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (startedFor.current === jobPostingId) return;
    startedFor.current = jobPostingId;

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `/api/questions?jobPostingId=${encodeURIComponent(jobPostingId)}`,
          { signal: controller.signal, headers: { Accept: "text/event-stream" } },
        );

        if (!res.ok || !res.body) {
          setError((await res.text()) || "질문을 불러오지 못했습니다.");
          setStatus("error");
          return;
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;

          // SSE 는 빈 줄로 이벤트를 구분한다.
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const payload = frame
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim())
              .join("");
            if (!payload) continue;

            let event: QuestionStreamEvent;
            try {
              event = JSON.parse(payload) as QuestionStreamEvent;
            } catch {
              continue;
            }
            applyEvent(event);
          }
        }

        setStatus((s) => (s === "error" ? s : "done"));
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError("연결이 끊겼습니다. 새로고침 후 다시 시도해주세요.");
        setStatus("error");
      }
    })();

    function applyEvent(event: QuestionStreamEvent) {
      switch (event.type) {
        case "meta":
          setExpected(event.total);
          break;
        case "question":
          setQuestions((prev) => [...prev, event.question]);
          break;
        case "done":
          setStatus("done");
          break;
        case "error":
          setError(event.message);
          setStatus("error");
          break;
      }
    }

    return () => {
      controller.abort();
      // 가드를 풀어 둔다 — StrictMode 의 재실행이 다시 시작할 수 있어야 한다.
      if (startedFor.current === jobPostingId) startedFor.current = null;
    };
  }, [jobPostingId]);

  const remaining = Math.max(0, expected - questions.length);
  const byId = new Map(requirements.map((r) => [r.id, r]));

  const fitOf = (q: Question) => (q.requirementId ? fits?.[q.requirementId] : undefined);

  /**
   * **스트리밍 중에는 절대 재정렬하지 않는다.** 질문이 하나씩 도착하는 게 이 제품의 시그니처인데
   * 도착할 때마다 순서가 바뀌면 읽던 카드가 눈앞에서 옮겨간다. 스트림이 끝나고 사용자가
   * 직접 켰을 때만 정렬한다.
   */
  const canSort = status === "done" && !!fits && questions.length > 1;
  const shown =
    canSort && sorted
      ? [...questions].sort((a, b) => questionPriority(fitOf(a)) - questionPriority(fitOf(b)))
      : questions;

  return (
    <div className="q-list">
      {canSort && (
        <div className="q-sort">
          <label className="q-sort-toggle">
            <input
              type="checkbox"
              checked={sorted}
              onChange={(e) => setSorted(e.target.checked)}
            />
            내 경력 기준으로 정렬
          </label>
          <span className="hint">근거를 준비해야 할 질문이 위로 옵니다</span>
        </div>
      )}

      {shown.map((q, i) => (
        <QuestionCard
          key={q.id}
          question={q}
          index={i}
          requirement={q.requirementId ? (byId.get(q.requirementId) ?? null) : null}
          fit={fitOf(q)}
        />
      ))}

      {status === "streaming" && (
        <>
          <div className="streaming">
            <span className="dot" />
            {questions.length === 0
              ? "질문을 만들고 있습니다…"
              : `질문을 만들고 있습니다… (${questions.length}/${expected})`}
          </div>
          {Array.from({ length: Math.min(remaining, 2) }).map((_, i) => (
            <div className="skeleton" key={`sk-${i}`} />
          ))}
        </>
      )}

      {status === "error" && error && (
        <div className="notice" data-tone="error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
