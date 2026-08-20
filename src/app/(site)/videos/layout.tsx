import ProfileNav, { type ProfileNavItem } from "@/components/ProfileNav";

/**
 * 영상 요약 껍데기 — 프로필과 같은 왼쪽 메뉴 + 오른쪽 본문 (`pf-shell` 재사용).
 *
 * 보고서 페이지(/videos/[id])도 이 안에 있다 — 공유 링크로 온 방문자에게도 메뉴가
 * 보이는데, 그게 "나도 요약해 볼까"의 진입로라 숨기지 않는다.
 */
const ITEMS: readonly ProfileNavItem[] = [
  { href: "/videos", label: "영상 요약", hint: "유튜브 영상 요약하기" },
  { href: "/videos/history", label: "요약 기록", hint: "요약한 영상 목록" },
];

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pf-shell">
      <ProfileNav items={ITEMS} label="영상 요약 메뉴" />
      <div className="pf-body">{children}</div>
    </div>
  );
}
