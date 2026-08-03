"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { MAX_JD_LENGTH, MIN_JD_LENGTH } from "@/lib/jd/normalize";
import { useJdSubmit } from "@/lib/jd/use-submit";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * 히어로.
 *
 * 접힌 입력판을 누르면 화면을 옮기지 않고 그 자리에서 textarea 로 펼쳐진다 —
 * 붙여넣으려고 온 사람을 한 번 더 이동시킬 이유가 없다.
 *
 * 다만 접힌 상태는 여전히 /analyze 로 가는 **진짜 링크**다. JS 가 죽었거나
 * 새 탭으로 여는 클릭이면 그대로 이동해서 같은 일을 할 수 있어야 한다.
 */
export default function Hero() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const jd = useJdSubmit();

  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE },
        };

  // 펼친 뒤 곧바로 쓸 수 있어야 한다. 한 번 더 클릭하게 만들지 않는다.
  useEffect(() => {
    if (open) taRef.current?.focus();
  }, [open]);

  function handleTrigger(e: MouseEvent<HTMLAnchorElement>) {
    // 새 탭·새 창으로 열려는 클릭은 가로채지 않는다.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setOpen(true);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // 쓰던 걸 날리면 안 되니 비어 있을 때만 접는다.
    if (e.key === "Escape" && !jd.text) {
      setOpen(false);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  const fade = reduced
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.16, ease: EASE },
      };

  return (
    <section className="bleed hero-band">
      <div className="hero-tint" aria-hidden="true" />

      <div className="bleed-inner hero-inner">
        <motion.h1 className="hero-h1" {...rise(0)}>
          <span className="hero-line">
            공고 하나로 <span className="hero-accent">면접 준비 완료</span>
          </span>
        </motion.h1>

        <motion.p className="hero-p" {...rise(0.08)}>
          자격요건을 한 줄씩 쪼개고, 줄마다 실제로 물어볼 만한 질문과 답변 뼈대를 만듭니다.
        </motion.p>

        <motion.div {...rise(0.16)}>
          <motion.div
            className="hero-compose"
            data-open={open}
            layout={!reduced}
            transition={{ layout: { duration: 0.44, ease: EASE } }}
          >
            {/* wait 로 두면 접힌 판이 사라진 뒤에야 폼이 들어와 높이가 0 으로 한 번
                주저앉는다. popLayout 은 빠지는 쪽을 레이아웃에서 바로 빼므로
                컨테이너가 곧장 폼 높이로 자란다. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {open ? (
                <motion.form key="form" className="hero-compose-form" onSubmit={jd.submit} {...fade}>
                  <textarea
                    ref={taRef}
                    className="hero-compose-ta"
                    value={jd.text}
                    onChange={(e) => jd.setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="채용공고 본문을 통째로 붙여넣으세요. 자격요건·우대사항·담당업무가 모두 들어 있을수록 질문이 정확해집니다."
                    disabled={jd.busy}
                    aria-label="채용공고 본문"
                  />

                  <div className="hero-compose-foot">
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
                    <div className="notice" data-tone="error" role="alert">
                      {jd.error}
                    </div>
                  )}
                </motion.form>
              ) : (
                <motion.div key="cta" {...fade}>
                  <Link
                    href="/analyze"
                    className="hero-compose-trigger"
                    onClick={handleTrigger}
                    aria-expanded={false}
                  >
                    <span className="hero-compose-text">여기에 채용공고를 붙여넣으세요</span>
                    <span className="hero-compose-btn" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 10h11M11 5l5 5-5 5" />
                      </svg>
                    </span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        <motion.p className="hero-meta" {...rise(0.24)}>
          <span className="hero-live" aria-hidden="true" />
          로그인 없이 바로 사용 · 첫 질문까지 보통 1~2초
        </motion.p>
      </div>
    </section>
  );
}
