"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

export interface MenuUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * 헤더의 계정 드롭다운.
 *
 * 접근성 요건을 직접 챙긴다 (라이브러리 없이):
 *  - 트리거에 aria-expanded / aria-haspopup
 *  - Escape 로 닫고 포커스를 트리거로 되돌림
 *  - 바깥 클릭·라우트 이동 시 자동으로 닫힘
 *  - 방향키로 항목 이동
 */
export default function UserMenu({
  user,
  signOutAction,
}: {
  user: MenuUser;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const pathname = usePathname();

  // 라우트가 바뀌면 닫는다 (메뉴에서 링크를 눌렀을 때).
  // effect 로 setState 하면 렌더가 한 번 더 도는 캐스케이드가 생기므로,
  // React 가 권장하는 "렌더 중 상태 조정" 패턴을 쓴다.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function moveFocus(delta: number, from: HTMLElement) {
    const items = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>("[data-menuitem]") ?? [],
    );
    const i = items.indexOf(from);
    const next = items[(i + delta + items.length) % items.length];
    next?.focus();
  }

  const label = user.name ?? user.email ?? "내 계정";
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="menu-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label} 계정 메뉴`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => {
              rootRef.current?.querySelector<HTMLElement>("[data-menuitem]")?.focus();
            });
          }
        }}
      >
        {user.image ? (
          // 외부 이미지 최적화를 켜려면 next.config 에 도메인 등록이 필요해 img 를 쓴다.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" width={30} height={30} className="avatar" />
        ) : (
          <span className="avatar avatar-fallback" aria-hidden="true">
            {initial}
          </span>
        )}
        <svg
          className="caret"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden="true"
          data-open={open}
        >
          <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          className="menu"
          id={menuId}
          role="menu"
          aria-label="계정 메뉴"
          onKeyDown={(e) => {
            const target = e.target as HTMLElement;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              moveFocus(1, target);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              moveFocus(-1, target);
            }
          }}
        >
          <div className="menu-head">
            <p className="menu-name">{user.name ?? "이름 없음"}</p>
            {user.email && <p className="menu-email">{user.email}</p>}
          </div>

          <div className="menu-sep" role="separator" />

          <Link href="/profile/history" className="menu-item" role="menuitem" data-menuitem>
            <IconList />내 기록
          </Link>
          <Link href="/profile/settings" className="menu-item" role="menuitem" data-menuitem>
            <IconKey />내 설정
          </Link>

          <div className="menu-sep" role="separator" />

          <form action={signOutAction}>
            <button type="submit" className="menu-item danger" role="menuitem" data-menuitem>
              <IconOut />로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* 아이콘 — 외부 아이콘 패키지를 더하지 않으려고 최소한만 인라인으로 둔다 */

function IconList() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M5.5 4h7M5.5 8h7M5.5 12h7M2.5 4h.01M2.5 8h.01M2.5 12h.01" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="3" />
      <path d="M7.8 7.8L13 13M11 11l-1.2 1.2M13 13l1-1" />
    </svg>
  );
}

function IconOut() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6M10.5 11L14 8l-3.5-3M14 8H6" />
    </svg>
  );
}
