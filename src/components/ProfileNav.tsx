"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ProfileNavItem {
  href: string;
  label: string;
  hint: string;
}

/**
 * 프로필 왼쪽 메뉴.
 *
 * 헤더의 `NavLink` 를 쓰지 않는다 — 저쪽은 `startsWith` 로 현재 위치를 따지는데,
 * 여기서는 `/profile` 이 모든 하위 항목의 접두사라 전부 활성으로 잡힌다.
 * 여기서는 정확히 일치할 때만 활성이다.
 *
 * 좁은 화면에서는 CSS 가 이걸 가로 탭으로 눕힌다 (`.pf-nav` 참고).
 * 마크업이 같으므로 링크 순서와 접근성 표시는 두 배치에서 동일하다.
 */
export default function ProfileNav({
  items,
  label = "프로필 메뉴",
}: {
  items: readonly ProfileNavItem[];
  label?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="pf-nav" aria-label={label}>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="pf-nav-item"
            data-active={active}
            aria-current={active ? "page" : undefined}
          >
            <span className="pf-nav-label">{item.label}</span>
            <span className="pf-nav-hint">{item.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
