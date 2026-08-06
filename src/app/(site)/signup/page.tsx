import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGitHub } from "@/app/actions/auth";
import { signUpWithPassword } from "@/app/actions/credentials";
import { auth } from "@/auth";
import CredentialsForm from "@/components/CredentialsForm";
import GitHubMark from "@/components/GitHubMark";

export const metadata: Metadata = {
  title: "회원가입",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl = "/profile/history" } = await searchParams;

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  return (
    <section className="auth-shell">
      <h1 className="auth-title">회원가입</h1>
      <p className="auth-lede">
        가입하면 넣은 공고와 만든 질문이 계정에 저장돼 다른 기기에서도 열어볼 수 있습니다.
        로그인 전에 만든 기록도 이 브라우저의 것이라면 그대로 옮겨집니다.
      </p>

      <form action={signInWithGitHub}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <button type="submit" className="gh-btn">
          <GitHubMark />
          GitHub로 가입하기
        </button>
      </form>

      <div className="divider">
        <span>또는 이메일로</span>
      </div>

      <CredentialsForm mode="signup" action={signUpWithPassword} callbackUrl={callbackUrl} />

      <p className="auth-alt">
        이미 계정이 있으신가요?{" "}
        <Link href={`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>로그인</Link>
      </p>

      <p className="footnote">
        이메일과 이름만 저장하며, 비밀번호는 scrypt 로 해싱해 보관합니다.
        아직 이메일 인증은 하지 않으므로 비밀번호 재설정 기능이 없습니다.
      </p>
    </section>
  );
}
