import ProfileNav, { type ProfileNavItem } from "@/components/ProfileNav";

/**
 * 영상 요약 공용 껍데기 — 좌측 메뉴 + 본문 (프로필의 pf-shell 재사용).
 *
 * 레이아웃((menu) 그룹)과 보고서 페이지의 비-DONE 상태가 같이 쓴다. 완료된 보고서만
 * 3분할 전폭이고, 대기·진행·실패·거부 화면은 메뉴가 있어야 사용자가 다음 행동
 * (다른 영상 넣기, 기록 보기)으로 이동할 수 있다.
 */
const ITEMS: readonly ProfileNavItem[] = [
  { href: "/videos", label: "영상 요약", hint: "유튜브 영상 요약하기" },
  { href: "/videos/history", label: "요약 기록", hint: "요약한 영상 목록" },
];

export default function VideosShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pf-shell">
      <ProfileNav items={ITEMS} label="영상 요약 메뉴" />
      <div className="pf-body">{children}</div>
    </div>
  );
}
