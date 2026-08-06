import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGitHub } from "@/app/actions/auth";
import { signInWithPassword } from "@/app/actions/credentials";
import { auth } from "@/auth";
import CredentialsForm from "@/components/CredentialsForm";
import GitHubMark from "@/components/GitHubMark";

export const metadata: Metadata = {
  title: "로그인",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; reset?: string }>;
}) {
  const { callbackUrl = "/profile/history", error, reset } = await searchParams;

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  return (
    <section className="auth-shell">
      <h1 className="auth-title">로그인</h1>
      <p className="auth-lede">
        로그인하면 지금까지 넣은 공고와 만든 질문을 다시 열어볼 수 있습니다.
        로그인 전에 만든 기록도 이 브라우저의 것이라면 그대로 옮겨집니다.
      </p>

      {reset === "1" && (
        <div className="notice" data-tone="ok" role="status" style={{ marginBottom: 18 }}>
          비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.
        </div>
      )}

      {error && (
        <div className="notice" data-tone="error" role="alert" style={{ marginBottom: 18 }}>
          {error === "OAuthAccountNotLinked"
            ? "이 이메일은 다른 방식으로 이미 가입되어 있습니다. 처음 가입할 때 쓴 방법으로 로그인해주세요."
            : "로그인에 실패했습니다. 다시 시도해주세요."}
        </div>
      )}

      <form action={signInWithGitHub}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <button type="submit" className="gh-btn">
          <GitHubMark />
          GitHub로 계속하기
        </button>
      </form>

      <div className="divider">
        <span>또는 이메일로</span>
      </div>

      <CredentialsForm mode="signin" action={signInWithPassword} callbackUrl={callbackUrl} />

      <p className="auth-alt" style={{ marginTop: 12 }}>
        <Link href="/forgot-password">비밀번호를 잊으셨나요?</Link>
      </p>

      <p className="auth-alt">
        아직 계정이 없으신가요?{" "}
        <Link href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}>회원가입</Link>
      </p>

      <p className="footnote">
        GitHub 로그인은 계정의 이름·이메일·프로필 이미지만 받아 옵니다. 저장소 접근 권한은 요청하지 않습니다.
      </p>
    </section>
  );
}
