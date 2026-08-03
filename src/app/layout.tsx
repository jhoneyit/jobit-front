import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

/**
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
        <SmoothScroll />
        <div className="shell">
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
