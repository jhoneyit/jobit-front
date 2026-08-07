"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import type {
  FinishedInterview,
  InterviewQuestion,
  ScoredAnswer,
} from "@/lib/interviews";

type Phase = "ready" | "answering" | "scoring" | "scored" | "finished";

/**
 * 면접 연습 진행 — 문항 하나씩, 제한 시간 안에 말하고 바로 채점받는다.
 *
 * **문항마다 즉시 채점하는 이유**: 답하고 나서 바로 무엇을 놓쳤는지 봐야 다음 문항에서 고쳐
 * 말한다. 끝에 몰아 보여주면 그건 채점표지 연습이 아니다. 몰아서 한 번 부르는 쪽이 싸지만
 * 그러면 기능의 목적이 사라진다 (설계 문서 §4).
 *
 * **답변 뼈대는 채점 전에 보여주지 않는다.** 보고 답하면 연습이 아니다 — 서버도 시작 응답에
 * 뼈대를 담지 않으므로, 화면이 실수로 노출할 수도 없다.
 */
export default function InterviewRunner({
  sessionId,
  questions,
  startIndex = 0,
}: {
  sessionId: string;
  questions: InterviewQuestion[];
  /** 새로고침 후 이어서 시작할 문항. 이미 답한 문항 수다 */
  startIndex?: number;
}) {
  const [index, setIndex] = useState(startIndex);
  const [phase, setPhase] = useState<Phase>("ready");
  const [remaining, setRemaining] = useState(
    questions[startIndex]?.timeLimitSec ?? 90,
  );
  const [scored, setScored] = useState<ScoredAnswer | null>(null);
  const [finished, setFinished] = useState<FinishedInterview | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 인식이 안 되는 브라우저를 위한 직접 입력. 채점 경로는 입력 수단을 가리지 않는다 */
  const [typed, setTyped] = useState("");

  const speech = useSpeechRecognition();
  const startedAtRef = useRef<number>(0);
  /** 제한 시간 만료와 "그만 말하기" 버튼이 동시에 제출하는 것을 막는다 */
  const submittingRef = useRef(false);

  const question = questions[index];
  const isLast = index === questions.length - 1;

  const submit = useCallback(
    async (transcript: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;

      speech.stop();
      setPhase("scoring");
      setError(null);

      try {
        const res = await fetch(`/api/interview/${sessionId}/answer`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            questionId: question.questionId,
            transcript,
            durationMs: startedAtRef.current
              ? Date.now() - startedAtRef.current
              : 0,
          }),
        });
        const body = (await res.json()) as ScoredAnswer & { error?: string };
        if (!res.ok) {
          setError(body.error ?? "채점 중 오류가 발생했습니다.");
          // **답변을 잃지 않는다.** 다시 제출할 수 있어야 하므로 answering 으로 되돌린다.
          setPhase("answering");
          return;
        }
        setScored(body);
        setPhase("scored");
      } catch {
        setError("채점 서버에 연결하지 못했습니다.");
        setPhase("answering");
      } finally {
        submittingRef.current = false;
      }
    },
    [question, sessionId, speech],
  );

  // 제한 시간. 0 이 되면 자동 제출한다 — 실제 면접처럼 시간이 끝나면 거기까지가 답변이다.
  useEffect(() => {
    if (phase !== "answering") return;
    if (remaining <= 0) {
      void submit(speech.supported ? speech.transcript : typed);
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, remaining, submit, speech.supported, speech.transcript, typed]);

  function beginAnswering() {
    setError(null);
    setTyped("");
    speech.reset();
    setRemaining(question.timeLimitSec);
    startedAtRef.current = Date.now();
    setPhase("answering");
    if (speech.supported) speech.start();
  }

  function goNext() {
    setScored(null);
    setIndex((i) => i + 1);
    setRemaining(questions[index + 1]?.timeLimitSec ?? 90);
    setPhase("ready");
  }

  async function finish() {
    setPhase("scoring");
    try {
      const res = await fetch(`/api/interview/${sessionId}/finish`, {
        method: "POST",
      });
      const body = (await res.json()) as FinishedInterview & { error?: string };
      if (!res.ok) {
        setError(body.error ?? "면접 연습을 마치지 못했습니다.");
        setPhase("scored");
        return;
      }
      setFinished(body);
      setPhase("finished");
    } catch {
      setError("서버에 연결하지 못했습니다.");
      setPhase("scored");
    }
  }

  if (phase === "finished" && finished) {
    return <Summary result={finished} />;
  }

  const spoken = speech.supported ? speech.transcript : typed;

  return (
    <section className="iv">
      <ol className="iv-progress" aria-label="진행 상황">
        {questions.map((q, i) => (
          <li
            key={q.questionId}
            data-state={i < index ? "done" : i === index ? "current" : "todo"}
          >
            <span className="sr-only">
              {i + 1}번 문항 {i < index ? "완료" : i === index ? "진행 중" : "대기"}
            </span>
          </li>
        ))}
      </ol>

      <div className="iv-head">
        <span className="iv-count">
          {index + 1} / {questions.length}
        </span>
        <span className="chip">{question.category}</span>
        {phase === "answering" && (
          <span className="iv-timer" data-low={remaining <= 10 || undefined}>
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </span>
        )}
      </div>

      <h2 className="iv-question">{question.text}</h2>

      {error && (
        <div className="notice" data-tone="error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {phase === "ready" && (
        <ReadyPanel
          supported={speech.supported}
          timeLimitSec={question.timeLimitSec}
          onStart={beginAnswering}
        />
      )}

      {phase === "answering" && (
        <div className="iv-answer">
          {speech.supported ? (
            <>
              <p className="iv-mic" data-on={speech.listening || undefined}>
                {speech.listening ? "듣고 있습니다" : "마이크가 멈췄습니다"}
              </p>
              <p className="iv-transcript" aria-live="polite">
                {speech.transcript}
                {speech.interim && (
                  <span className="iv-interim"> {speech.interim}</span>
                )}
                {!speech.transcript && !speech.interim && (
                  <span className="iv-hint">말씀하시면 여기에 받아 적습니다…</span>
                )}
              </p>
              {speech.error && (
                <div className="notice" data-tone="warn" style={{ marginTop: 12 }}>
                  {speech.error}
                </div>
              )}
            </>
          ) : (
            <textarea
              className="iv-textarea"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="답변을 입력해 주세요."
              maxLength={10_000}
              autoFocus
            />
          )}

          <div className="iv-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void submit(spoken)}
            >
              답변 마치기
            </button>
            {/* 시간 내에 못 답하는 것도 결과다. 건너뛰기를 숨기면 사용자가 화면에 갇힌다. */}
            <button
              type="button"
              className="iv-skip"
              onClick={() => void submit("")}
            >
              모르겠습니다 (건너뛰기)
            </button>
          </div>
        </div>
      )}

      {phase === "scoring" && <p className="iv-scoring">채점하고 있습니다…</p>}

      {phase === "scored" && scored && (
        <ScorePanel
          scored={scored}
          isLast={isLast}
          onNext={goNext}
          onFinish={() => void finish()}
        />
      )}
    </section>
  );
}

/**
 * 마이크를 켜기 전 화면.
 *
 * **여기서 오디오가 어디로 가는지 밝힌다.** "우리 서버에 저장하지 않는다"는 사실이지만
 * "음성이 아무 데도 안 간다"는 사실이 아니다 — Chrome 은 인식을 위해 오디오를 구글 서버로
 * 보낸다. 개발자 타깃 제품에서 이걸 숨기면 바로 신뢰를 잃는다.
 */
function ReadyPanel({
  supported,
  timeLimitSec,
  onStart,
}: {
  supported: boolean | null;
  timeLimitSec: number;
  onStart: () => void;
}) {
  return (
    <div className="iv-ready">
      {supported === false && (
        <div className="notice" data-tone="warn">
          이 브라우저는 음성 인식을 지원하지 않습니다 (Firefox 등). 대신 직접 입력할 수
          있고, 채점은 똑같이 진행됩니다.
        </div>
      )}

      {supported && (
        <p className="iv-privacy">
          답변은 <strong>브라우저가 받아 적어 글자만</strong> 서버로 보냅니다. 녹음 파일은
          저장하지 않습니다. 다만 Chrome은 음성 인식을 위해{" "}
          <strong>오디오를 구글 서버로 전송</strong>합니다.
        </p>
      )}

      <button type="button" className="btn-primary btn-lg" onClick={onStart}>
        {supported ? "마이크 켜고 답변 시작" : "답변 시작"} ({timeLimitSec}초)
      </button>
    </div>
  );
}

/** 채점 결과 — 여기서 답변 뼈대가 처음 공개된다. */
function ScorePanel({
  scored,
  isLast,
  onNext,
  onFinish,
}: {
  scored: ScoredAnswer;
  isLast: boolean;
  onNext: () => void;
  onFinish: () => void;
}) {
  const covered = new Set(scored.covered);

  return (
    <div className="iv-score">
      <div className="iv-score-head">
        <strong className="iv-score-num" data-tier={tierOf(scored.score)}>
          {scored.score}
        </strong>
        <span>점</span>
        {!scored.answered && <span className="iv-unanswered">답변 없음</span>}
      </div>

      <ul className="iv-outline">
        {scored.outline.map((point, i) => (
          <li key={point} data-covered={covered.has(i) || undefined}>
            <span aria-hidden="true">{covered.has(i) ? "✓" : "✗"}</span>
            <span className="sr-only">{covered.has(i) ? "짚음" : "놓침"}</span>
            {point}
          </li>
        ))}
      </ul>

      {scored.feedback && <p className="iv-feedback">{scored.feedback}</p>}

      <div className="iv-actions">
        {isLast ? (
          <button type="button" className="btn-primary" onClick={onFinish}>
            결과 보기
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={onNext}>
            다음 문항 →
          </button>
        )}
      </div>
    </div>
  );
}

function Summary({ result }: { result: FinishedInterview }) {
  return (
    <section className="iv-summary">
      <h2>연습을 마쳤습니다</h2>
      <div className="iv-score-head">
        <strong className="iv-score-num" data-tier={tierOf(result.totalScore)}>
          {result.totalScore}
        </strong>
        <span>점</span>
      </div>
      <p className="iv-summary-meta">
        {result.questionCount}문항 중 {result.answeredCount}문항에 답했습니다.
        {result.answeredCount < result.questionCount && (
          <>
            {" "}
            <span className="iv-hint">답하지 않은 문항은 0점으로 계산됩니다.</span>
          </>
        )}
      </p>
      <div className="iv-actions">
        {/* TODO(면접 기록): /profile/interviews 가 생기면 "내 기록 보기"를 주 버튼으로 둔다. */}
        <Link href="/interview" className="btn-primary">
          다른 공고로 연습하기
        </Link>
      </div>
    </section>
  );
}

/** 점수대를 색으로 나눈다. 숫자만으로는 잘했는지 한눈에 안 들어온다. */
function tierOf(score: number): "low" | "mid" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}
