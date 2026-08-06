import Image from "next/image";
import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";
import { auth } from "@/auth";
import HeaderChrome from "@/components/HeaderChrome";
import NavLink from "@/components/NavLink";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";

export default async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="topbar">
      {/* 랜딩 최상단에서는 헤더를 히어로 위에 투명하게 얹는다 */}
      <HeaderChrome />

      <div className="topbar-inner">
        <Link href="/" className="brand">
          <Image
            className="brand-logo"
            src="/logo-wordmark.png"
            alt="jobit"
            width={207}
            height={84}
            priority
          />
        </Link>

        <nav className="nav" aria-label="주요 메뉴">
          <NavLink href="/analyze">공고 분석</NavLink>
          {/* 하위 주소는 /profile 이 정한다 — 헤더는 진입점만 안다 */}
          <NavLink href="/profile">프로필</NavLink>

          <ThemeToggle />

          {user ? (
            <UserMenu
              user={{
                name: user.name ?? null,
                email: user.email ?? null,
                image: user.image ?? null,
              }}
              signOutAction={signOutAction}
            />
          ) : (
            <span className="nav-auth">
              <Link href="/signin" className="nav-link">
                로그인
              </Link>
              <span className="nav-sep" aria-hidden="true" />
              <Link href="/signup" className="nav-link">
                회원가입
              </Link>
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
