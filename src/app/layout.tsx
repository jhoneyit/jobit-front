import type { Metadata } from "next";
import "./globals.css";

/**
 * 루트 레이아웃 — `<html>`/`<body>` 와 테마만 담당한다.
 *
 * 헤더·푸터·부드러운 스크롤은 여기가 아니라 `(site)/layout.tsx` 에 있다. `/admin` 은
 * 마케팅 크롬이 붙으면 안 되는 별개 화면이라, 둘이 같은 껍데기를 쓰면 관리자 페이지에
 * 사이트 헤더와 lenis 스크롤이 그대로 딸려온다. **라우트 그룹은 URL 에 영향을 주지 않으므로
 * 기존 주소는 전부 그대로다.**
 *
 * SSR 이 살아 있어야 공유 링크·질문 페이지가 검색에 잡힌다 (스펙 §2 "선택 이유").
 * 2단계에서 /q/[slug] 공유 페이지를 붙일 때 여기 메타데이터가 기준이 된다.
 */
export const metadata: Metadata = {
  title: {
    default: "JD 기반 기술 면접 준비",
    template: "%s | JD 기반 기술 면접 준비",
  },
  description:
    "채용공고를 붙여넣으면 그 공고에 맞는 예상 면접 질문과 답변 뼈대를 만들어 드립니다.",
  openGraph: {
    type: "website",
    siteName: "JD 기반 기술 면접 준비",
  },
};

/**
 * 다크를 고른 사용자에게 **첫 페인트 전에** 적용한다.
 *
 * React 가 붙은 뒤에 적용하면 흰 화면이 한 번 번쩍인다(FOUC). 그래서 body 최상단에서 동기로 실행한다.
 * 기본은 라이트이므로 저장값이 "dark" 일 때만 손대면 된다.
 * localStorage 가 막힌 환경(사생활 보호 모드 등)에서도 죽지 않도록 try 로 감싼다 — 그 경우 라이트로 뜬다.
 */
const THEME_INIT = `try{if(localStorage.getItem("theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {children}
      </body>
    </html>
  );
}
