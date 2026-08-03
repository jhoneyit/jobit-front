"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 현재 위치를 표시하는 내비 링크. aria-current 로 스크린리더에도 알린다. */
export default function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className="nav-link"
      data-active={active}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
