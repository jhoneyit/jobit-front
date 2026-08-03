"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * 관성 스크롤. 랜딩의 스크롤 연출이 붙는 기반이다.
 *
 * `prefers-reduced-motion` 이면 아예 켜지 않는다 — 스크롤 감각을 바꾸는 건
 * 멀미를 유발할 수 있어서, 모션을 줄이라고 한 사용자에게 강요하면 안 된다.
 * 앵커 이동(#start 등)도 Lenis 가 처리하도록 가로챈다.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      // 끝으로 갈수록 부드럽게 감속 (기본 easing 보다 덜 미끄럽다)
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // 터치는 브라우저 기본이 이미 자연스럽다. 건드리면 오히려 어색해진다.
      syncTouch: false,
    });

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    const onAnchorClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      const hash = link?.getAttribute("href");
      if (!hash || hash === "#") return;
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -72 });
    };
    document.addEventListener("click", onAnchorClick);

    return () => {
      document.removeEventListener("click", onAnchorClick);
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
