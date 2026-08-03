"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const EVENT = "jobit:theme";

/**
 * 테마 전환 (라이트 ↔ 다크).
 *
 * **라이트가 기본이다.** OS 설정을 자동으로 따라가지 않는다 —
 * 다크는 사용자가 여기서 직접 골랐을 때만 켜지고, 그 선택은 localStorage 에 남는다.
 *
 * localStorage 는 React 바깥의 저장소라, effect 에서 setState 로 읽으면
 * 렌더가 한 번 더 도는 캐스케이드가 생긴다. 그 용도로 만들어진
 * `useSyncExternalStore` 를 쓰고, 덕분에 다른 탭의 변경(storage)도 함께 따라간다.
 */
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  try {
    return localStorage.getItem("theme") === "dark" ? "dark" : "light";
  } catch {
    // 사생활 보호 모드 등에서 localStorage 가 막힐 수 있다
    return "light";
  }
}

/** 서버 렌더에는 저장값이 없다. 기본값(라이트)으로 그리고 hydration 후 맞춘다. */
function getServerSnapshot(): Theme {
  return "light";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "다크 모드" : "라이트 모드";

  function apply(value: Theme) {
    const root = document.documentElement;
    try {
      if (value === "dark") {
        root.dataset.theme = "dark";
        localStorage.setItem("theme", "dark");
      } else {
        delete root.dataset.theme;
        localStorage.removeItem("theme");
      }
    } catch {
      // 저장이 막혀도 이번 세션에는 적용되도록 DOM 은 그대로 바꾼다
      if (value === "dark") root.dataset.theme = "dark";
      else delete root.dataset.theme;
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button
      type="button"
      className="theme-btn"
      onClick={() => apply(next)}
      title={`${label}로 전환`}
      aria-label={`${label}로 전환`}
      aria-pressed={theme === "dark"}
    >
      <span className="theme-icon" data-ready={ready}>
        {theme === "dark" ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="10" cy="10" r="3.6" />
      <path d="M10 2v1.6M10 16.4V18M18 10h-1.6M3.6 10H2M15.7 4.3l-1.1 1.1M5.4 14.6l-1.1 1.1M15.7 15.7l-1.1-1.1M5.4 5.4L4.3 4.3" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.5 11.8A7 7 0 0 1 8.2 3.5a7 7 0 1 0 8.3 8.3Z" />
    </svg>
  );
}
