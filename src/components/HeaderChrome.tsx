"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 랜딩 최상단에서만 헤더를 히어로 위에 투명하게 얹는다.
 *
 * 히어로가 어두운 밴드라 라이트 모드에서 흰 헤더가 얹히면 경계선이 도드라진다.
 * 스크롤을 내리면 평소 헤더로 돌아온다.
 *
 * DOM 을 직접 건드리는 이유: 헤더는 서버 컴포넌트(auth 조회)라 상태를 들 수 없고,
 * 이 정보는 CSS 만 바꾸면 되는 표현 계층 문제이므로 body 속성 하나로 끝내는 게 가볍다.
 */
export default function HeaderChrome() {
  const pathname = usePathname();

  useEffect(() => {
    const isLanding = pathname === "/";
    const body = document.body;

    if (!isLanding) {
      body.removeAttribute("data-header-overlay");
      return;
    }

    const update = () => {
      // 히어로 밴드를 벗어나기 전까지만 오버레이
      if (window.scrollY < 120) body.setAttribute("data-header-overlay", "true");
      else body.removeAttribute("data-header-overlay");
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      body.removeAttribute("data-header-overlay");
    };
  }, [pathname]);

  return null;
}
