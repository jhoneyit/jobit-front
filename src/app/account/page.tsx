import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "계정 설정",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/account");

  const userId = session.user.id;

  const [[user], linked] = await Promise.all([
    db
      .select({ email: users.email, name: users.name, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ provider: accounts.provider })
      .from(accounts)
      .where(eq(accounts.userId, userId)),
  ]);

  const hasPassword = Boolean(user?.passwordHash);

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>계정 설정</h1>
      </section>

      <section className="section" style={{ marginTop: 0 }}>
        <div className="section-head">
          <h2>계정</h2>
        </div>
        <div className="card">
          <dl className="meta-grid">
            <dt>이름</dt>
            <dd>{user?.name ?? "—"}</dd>
            <dt>이메일</dt>
            <dd>{user?.email ?? "—"}</dd>
            <dt>로그인 방법</dt>
            <dd>
              <div className="chips">
                {linked.map((a) => (
                  <span className="chip" key={a.provider}>
                    {a.provider}
                  </span>
                ))}
                {hasPassword && <span className="chip">이메일 + 비밀번호</span>}
              </div>
            </dd>
          </dl>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{hasPassword ? "비밀번호 변경" : "비밀번호 설정"}</h2>
          <span className="hint">
            {hasPassword
              ? "변경하면 다른 기기에서는 다시 로그인해야 합니다"
              : "설정하면 이메일로도 로그인할 수 있습니다"}
          </span>
        </div>
        <div className="card">
          <ChangePasswordForm hasPassword={hasPassword} />
        </div>
      </section>
    </>
  );
}
