import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "비밀번호 재설정",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session?.user) redirect("/profile/history");

  return (
    <section className="auth-shell">
      <h1 className="auth-title">비밀번호 재설정</h1>
      <p className="auth-lede">
        가입한 이메일 주소를 입력하시면 재설정 링크를 보내드립니다.
      </p>

      <ForgotPasswordForm />

      <p className="auth-alt">
        <Link href="/signin">로그인으로 돌아가기</Link>
      </p>

      <p className="footnote">
        GitHub으로 가입하신 경우에는 설정된 비밀번호가 없습니다. GitHub으로 로그인해주세요.
      </p>
    </section>
  );
}
