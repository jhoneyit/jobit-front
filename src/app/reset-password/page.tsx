import type { Metadata } from "next";
import Link from "next/link";
import ResetPasswordForm from "@/components/ResetPasswordForm";
import { checkResetToken } from "@/lib/auth/reset";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "새 비밀번호 설정",
  // 토큰이 URL 에 있으므로 색인은 물론 링크 추적도 막는다
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const check = await checkResetToken(token);

  if (!check.valid) {
    const message =
      check.reason === "expired"
        ? "링크가 만료되었습니다. 30분이 지나면 자동으로 무효가 됩니다."
        : check.reason === "used"
          ? "이미 사용된 링크입니다. 비밀번호는 한 번만 변경할 수 있습니다."
          : "유효하지 않은 링크입니다. 주소가 잘리지 않았는지 확인해주세요.";

    return (
      <section className="auth-shell">
        <h1 className="auth-title">링크를 쓸 수 없습니다</h1>
        <div className="notice" data-tone="error" role="alert" style={{ marginBottom: 18 }}>
          {message}
        </div>
        <p className="auth-alt">
          <Link href="/forgot-password">재설정 링크 다시 받기 →</Link>
        </p>
      </section>
    );
  }

  return (
    <section className="auth-shell">
      <h1 className="auth-title">새 비밀번호 설정</h1>
      <ResetPasswordForm token={token} email={check.email} />
    </section>
  );
}
