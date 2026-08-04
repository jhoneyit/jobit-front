import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { adminDisabled, adminUser, isAdminAuthed, usingDefaultPassword } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "로그인" };

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) redirect("/admin");

  const disabled = adminDisabled();

  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <h1>관리자</h1>
        <p className="adm-login-lede">이 화면은 서비스 사용자 계정과 무관합니다.</p>

        {disabled ? (
          <p className="adm-error" role="alert">
            운영 환경에서는 기본 비밀번호로 열 수 없습니다. <code>ADMIN_PASSWORD</code> 를
            설정한 뒤 다시 시도해 주세요.
          </p>
        ) : (
          <>
            <AdminLoginForm defaultUser={adminUser()} />
            {usingDefaultPassword() && (
              <p className="adm-login-hint">
                기본 계정 <code>admin</code> / <code>admin</code> 으로 로그인합니다. 바꾸려면{" "}
                <code>.env.local</code> 에 <code>ADMIN_USER</code> ·{" "}
                <code>ADMIN_PASSWORD</code> 를 넣으세요.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
