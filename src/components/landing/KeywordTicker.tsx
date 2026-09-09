"use client";

import { useEffect, useRef, useState } from "react";

export interface KeywordItem {
  name: string;
  postings: number;
}

/** 한 줄이 머무는 시간. 읽고 다음 줄을 기다리는 호흡이다 — 너무 빠르면 광고판이 된다. */
const DWELL_MS = 3000;

/** 슬라이드 전환 시간. CSS 의 .hero-kw-list transition 과 같은 값이어야 되감기가 안 보인다. */
const SLIDE_MS = 450;

/**
 * 실시간 인기 검색어 스타일 티커 — 분석된 공고에서 집계한 키워드 순위가 한 줄씩
 * 위로 슬라이드되며 돈다.
 *
 * 무한 루프처럼 보이게 **첫 줄을 끝에 복제**해 두고, 복제 줄에 도착하면 전환이 끝난 뒤
 * 전환 없이 진짜 첫 줄로 되감는다. transitionend 대신 타이머로 되감는 이유:
 * `prefers-reduced-motion` 이 전환을 꺼 버리면 그 이벤트가 영영 안 와서 인덱스가
 * 목록 밖으로 걸어 나간다 — 타이머는 어느 쪽이든 온다.
 *
 * 모든 줄이 DOM 에 있으므로 스크린 리더와 검색엔진은 회전과 무관하게 전체 순위를 읽는다.
 */
export default function KeywordTicker({ items }: { items: KeywordItem[] }) {
  const [idx, setIdx] = useState(0);
  const [snap, setSnap] = useState(false);
  const paused = useRef(false);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => {
      if (!paused.current) setIdx((i) => i + 1);
    }, DWELL_MS);
    return () => clearInterval(timer);
  }, [items.length]);

  // 복제 줄(마지막 칸)에 도착 → 슬라이드가 끝나길 기다렸다 무전환으로 첫 줄 되감기.
  useEffect(() => {
    if (idx !== items.length || items.length < 2) return;
    const t = setTimeout(() => {
      setSnap(true);
      setIdx(0);
    }, SLIDE_MS + 30);
    return () => clearTimeout(t);
  }, [idx, items.length]);

  // 되감은 프레임이 그려진 다음에 전환을 되살린다 — 같은 프레임에 하면 역방향 슬라이드가 보인다.
  useEffect(() => {
    if (!snap) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setSnap(false)));
    return () => cancelAnimationFrame(raf);
  }, [snap]);

  if (items.length === 0) return null;

  const rows = [...items, items[0]];
  const pause = () => (paused.current = true);
  const resume = () => (paused.current = false);

  return (
    <div
      className="hero-kw"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <span className="hero-kw-label">
        <span className="hero-live" aria-hidden="true" />
        인기 키워드
      </span>
      <div className="hero-kw-viewport">
        <ul
          className="hero-kw-list"
          style={{
            transform: `translateY(${(-100 / rows.length) * idx}%)`,
            transition: snap ? "none" : undefined,
          }}
          aria-label="많이 분석된 키워드 순위"
        >
          {rows.map((item, i) => (
            // 마지막 줄은 루프용 복제라 보조기기에는 숨긴다.
            <li key={i} className="hero-kw-row" aria-hidden={i === rows.length - 1 || undefined}>
              <span className="hero-kw-rank" data-top={i % items.length < 3 || undefined}>
                {(i % items.length) + 1}
              </span>
              <span className="hero-kw-name">{item.name}</span>
              <span className="hero-kw-count">{item.postings}건</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
