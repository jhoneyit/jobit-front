"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 좌측 사이드바 메뉴.
 *
 * 현재 위치 표시 때문에 클라이언트 컴포넌트다. 정확히 일치(`exact`)와 접두사 일치를 나눈
 * 이유: `/admin` 은 모든 하위 경로의 접두사라, 접두사로만 판정하면 어느 메뉴에 있든
 * 대시보드가 늘 활성으로 보인다.
 */
const ITEMS = [
  { href: "/admin", label: "대시보드", exact: true },
  { href: "/admin/submissions", label: "제출 이력" },
  { href: "/admin/postings", label: "공고" },
  { href: "/admin/usage", label: "토큰 사용량" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="adm-nav" aria-label="관리자 메뉴">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="adm-nav-item"
            data-active={active || undefined}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
