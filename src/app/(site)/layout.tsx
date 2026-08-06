import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import SmoothScroll from "@/components/SmoothScroll";

/**
 * 사용자용 화면의 껍데기 — 헤더·푸터·부드러운 스크롤.
 *
 * <p>원래 루트 레이아웃에 있던 것을 그대로 내려온 것이다. `(site)` 는 라우트 그룹이라
 * URL 에 나타나지 않는다 — `/analyze` 는 여전히 `/analyze` 다.
 *
 * <p>SSR 이 살아 있어야 공유 링크·질문 페이지가 검색에 잡힌다 (스펙 §2 "선택 이유").
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SmoothScroll />
      <div className="shell">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </div>
    </>
  );
}
