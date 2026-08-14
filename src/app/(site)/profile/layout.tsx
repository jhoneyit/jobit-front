import ProfileNav, { type ProfileNavItem } from "@/components/ProfileNav";

/**
 * 프로필 껍데기 — 왼쪽 메뉴 + 오른쪽 본문.
 *
 * **로그인 가드를 여기 두지 않는다.** `/profile/history` 는 비로그인 상태에서도
 * 이 브라우저에 쌓인 익명 기록을 보여줘야 하고(`owner_key` 의 `anon:` 네임스페이스),
 * 로그인이 필요한 건 `/profile/settings` 뿐이라 그쪽이 스스로 막는다.
 * 여기서 한 번에 막으면 익명 기록을 볼 길이 사라진다.
 */
const ITEMS: readonly ProfileNavItem[] = [
  { href: "/profile/me", label: "내 정보", hint: "내 경력과 기술" },
  { href: "/profile/history", label: "내 기록", hint: "넣은 공고와 만든 질문" },
  { href: "/profile/resumes", label: "내 이력서", hint: "갭 분석에 쓰는 이력서" },
  { href: "/profile/interviews", label: "면접 기록", hint: "연습한 면접과 점수" },
  { href: "/profile/settings", label: "내 설정", hint: "계정과 비밀번호" },
];

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pf-shell">
      <ProfileNav items={ITEMS} />
      {/* 메뉴로 내용이 바뀌는 영역임을 알린다 — 스크린리더가 건너뛸 지점이 된다 */}
      <div className="pf-body">{children}</div>
    </div>
  );
}
