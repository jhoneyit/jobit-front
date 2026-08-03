"use client";

import { useEffect, useReducer, useRef, useState } from "react";

/**
 * 히어로의 제품 데모.
 *
 * 이 제품의 핵심 경험은 "공고를 붙여넣으면 질문이 하나씩 흘러나온다"는 것이다.
 * 그걸 글로 설명하는 대신 그대로 재연한다 — 타이핑 → 요구사항 추출 → 질문 스트리밍.
 *
 * 화면에 보일 때만 돌고, prefers-reduced-motion 이면 완성 상태를 정지 화면으로 보여준다.
 */

const JD_LINES = [
  "백엔드 엔지니어 (결제 플랫폼)",
  "",
  "자격요건",
  "· Java 또는 Kotlin 기반 개발 경험 3년 이상",
  "· Spring Boot 실무 경험",
  "· 대용량 트래픽 처리 경험",
  "",
  "우대사항",
  "· Kubernetes 운영 경험",
];

const REQUIREMENTS = [
  { text: "Java / Kotlin 3년+", kind: "REQUIRED" },
  { text: "Spring Boot 실무", kind: "REQUIRED" },
  { text: "대용량 트래픽 처리", kind: "REQUIRED" },
  { text: "Kubernetes 운영", kind: "PREFERRED" },
] as const;

const QUESTIONS = [
  {
    from: "대용량 트래픽 처리",
    text: "결제 API에 같은 주문이 동시에 두 번 들어오면 어떻게 막으시겠어요?",
    tag: "설계",
    level: 4,
  },
  {
    from: "Kubernetes 운영",
    text: "롤링 배포 중 결제 요청이 유실되지 않게 하려면 무엇을 설정해야 하나요?",
    tag: "스택",
    level: 3,
  },
  {
    from: "Spring Boot 실무",
    text: "트랜잭션 경계를 어디에 두시나요? 그렇게 정한 이유는요?",
    tag: "경험",
    level: 3,
  },
] as const;

type Phase = "typing" | "parsing" | "streaming" | "hold";

interface State {
  phase: Phase;
  typed: number;
  reqs: number;
  questions: number;
}

const INITIAL: State = { phase: "typing", typed: 0, reqs: 0, questions: 0 };

function reducer(s: State): State {
  switch (s.phase) {
    case "typing":
      return s.typed < JD_LINES.length
        ? { ...s, typed: s.typed + 1 }
        : { ...s, phase: "parsing" };
    case "parsing":
      return s.reqs < REQUIREMENTS.length
        ? { ...s, reqs: s.reqs + 1 }
        : { ...s, phase: "streaming" };
    case "streaming":
      return s.questions < QUESTIONS.length
        ? { ...s, questions: s.questions + 1 }
        : { ...s, phase: "hold" };
    case "hold":
      return INITIAL;
  }
}

const DELAY: Record<Phase, number> = {
  typing: 130,
  parsing: 200,
  streaming: 900,
  hold: 3200,
};

const DONE: State = {
  phase: "hold",
  typed: JD_LINES.length,
  reqs: REQUIREMENTS.length,
  questions: QUESTIONS.length,
};

export default function HeroDemo() {
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);
  const [state, tick] = useReducer(reducer, INITIAL);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible) return;
    const id = setTimeout(tick, DELAY[state.phase]);
    return () => clearTimeout(id);
  }, [state, reduced, visible]);

  const s = reduced ? DONE : state;
  const streaming = s.phase === "streaming";

  return (
    <div className="demo" ref={ref} aria-hidden="true">
      <div className="demo-pane demo-input">
        <div className="demo-bar">
          <span className="demo-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="demo-label">채용공고 붙여넣기</span>
        </div>
        <pre className="demo-jd">
          {JD_LINES.slice(0, s.typed).map((line, i) => (
            <span key={i} className="demo-line">
              {line || " "}
            </span>
          ))}
          {s.phase === "typing" && <span className="demo-caret" />}
        </pre>
      </div>

      <div className="demo-arrow" data-active={s.phase !== "typing"}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>

      <div className="demo-pane demo-output">
        <div className="demo-bar">
          <span className="demo-label">
            {s.phase === "typing"
              ? "대기 중"
              : s.phase === "parsing"
                ? "요구사항 추출 중"
                : streaming
                  ? `질문 생성 중 ${s.questions}/${QUESTIONS.length}`
                  : "완료"}
          </span>
          {(s.phase === "parsing" || streaming) && <span className="demo-live" />}
        </div>

        <div className="demo-chips">
          {REQUIREMENTS.slice(0, s.reqs).map((r) => (
            <span key={r.text} className="demo-chip" data-kind={r.kind}>
              {r.text}
            </span>
          ))}
        </div>

        <div className="demo-qs">
          {QUESTIONS.slice(0, s.questions).map((q) => (
            <div className="demo-q" key={q.text}>
              <div className="demo-q-top">
                <span className="demo-q-tag">{q.tag}</span>
                <span className="demo-q-level">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} data-on={n <= q.level} />
                  ))}
                </span>
              </div>
              <p className="demo-q-text">{q.text}</p>
              <p className="demo-q-from">← {q.from}</p>
            </div>
          ))}
          {streaming && (
            <div className="demo-skel">
              <span />
              <span />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
