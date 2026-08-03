"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * 히어로.
 *
 * 실제 입력은 /analyze 에 있으므로 여기 판은 그 화면으로 보내는 링크다.
 * 입력창처럼 보이지만 role 을 흉내 내지 않고 평범한 링크로 두었다 —
 * 스크린리더에 입력창으로 잘못 안내되면 안 된다.
 */
export default function Hero() {
  const reduced = useReducedMotion();

  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE },
        };

  return (
    <section className="bleed hero-band">
      <div className="hero-tint" aria-hidden="true" />

      <div className="bleed-inner hero-inner">
        <motion.h1 className="hero-h1" {...rise(0)}>
          <span className="hero-line">이 공고의 면접은</span>
          <span className="hero-line">
            <span className="hero-accent">이 공고</span>로 준비하세요
          </span>
        </motion.h1>

        <motion.p className="hero-p" {...rise(0.08)}>
          채용공고를 붙여넣으면 자격요건에서 뽑아낸 예상 질문과 답변 뼈대를 만들어 드립니다.
        </motion.p>

        <motion.div {...rise(0.16)}>
          <Link href="/analyze" className="hero-search">
            <span className="hero-search-text">여기에 채용공고를 붙여넣으세요</span>
            <span className="hero-search-btn" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10h11M11 5l5 5-5 5" />
              </svg>
            </span>
          </Link>
        </motion.div>

        <motion.p className="hero-meta" {...rise(0.24)}>
          <span className="hero-live" aria-hidden="true" />
          로그인 없이 바로 사용 · 첫 질문까지 보통 1~2초
        </motion.p>
      </div>
    </section>
  );
}
