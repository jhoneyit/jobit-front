import Link from "next/link";
import { redirect } from "next/navigation";
import { adminLogout } from "@/app/admin/actions";
import AdminNav from "@/components/admin/AdminNav";
import { isAdminAuthed, usingDefaultPassword } from "@/lib/admin/auth";

/**
 * 로그인이 필요한 관리자 화면 전부의 공통 껍데기.
 *
 * **인증 검사가 여기 한 곳뿐이다.** 라우트 그룹 `(dash)` 안의 모든 페이지가 이 레이아웃을
 * 지나므로, 새 페이지를 추가할 때 가드를 깜빡할 여지가 없다. 미들웨어를 쓰지 않은 것도
 * 같은 이유 — 매처 패턴을 따로 관리하면 경로를 추가하다 빠뜨린다.
 */
export default async function AdminDashLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthed())) redirect("/admin/login");

  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <Link href="/admin" className="adm-brand">
          jobit <span>admin</span>
        </Link>

        <AdminNav />

        <div className="adm-side-foot">
          {usingDefaultPassword() && (
            <p className="adm-warn">
              기본 비밀번호를 쓰고 있습니다. 로컬에서만 사용하세요.
            </p>
          )}
          <Link href="/" className="adm-side-link">
            ← 서비스로
          </Link>
          <form action={adminLogout}>
            <button type="submit" className="adm-side-link adm-side-logout">
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      <main className="adm-main">{children}</main>
    </div>
  );
}
