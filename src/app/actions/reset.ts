"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { normalizeEmail, validatePassword } from "@/lib/auth/password";
import { consumeResetToken, issueResetToken, purgeStaleTokens, RESET_TTL_MIN } from "@/lib/auth/reset";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";
import { baseUrl, mailer } from "@/lib/mail";
import { oauthOnlyMail, passwordResetMail } from "@/lib/mail/templates";
import { clearLoginFailures, consumeResetRequest } from "@/lib/rate-limit";

export interface ForgotState {
  sent?: boolean;
  error?: string;
  email?: string;
}

/**
 * 재설정 메일 요청.
 *
 * **어떤 경우에도 같은 화면을 돌려준다** — 가입된 이메일인지, 한도를 넘겼는지,
 * GitHub 계정인지 구분되면 그 자체가 계정 정보 유출이다(계정 열거).
 * 실제 분기는 전부 "어떤 메일을 보낼지"에서만 일어난다.
 */
export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const rawEmail = String(formData.get("email") ?? "");
  const email = normalizeEmail(rawEmail);

  // 형식이 틀렸을 때만 즉시 알려준다 (오타를 잡아주는 편이 낫고, 정보 유출은 아니다)
  if (!email) return { email: rawEmail, error: "이메일 형식이 올바르지 않습니다." };

  const SENT: ForgotState = { sent: true, email };

  if (!consumeResetRequest(email)) return SENT; // 한도 초과 — 티 내지 않는다

  try {
    const [user] = await db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) return SENT; // 없는 계정 — 메일도 안 보내고 같은 화면

    const send = mailer().send.bind(mailer());

    if (!user.passwordHash) {
      // GitHub 로만 가입 → 재설정 링크 대신 안내
      const [linked] = await db
        .select({ provider: accounts.provider })
        .from(accounts)
        .where(eq(accounts.userId, user.id))
        .limit(1);
      await send(oauthOnlyMail({ to: email, provider: linked?.provider ?? "소셜" }));
      return SENT;
    }

    const token = await issueResetToken(user.id);
    const url = `${baseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    await send(passwordResetMail({ to: email, url, ttlMin: RESET_TTL_MIN }));

    void purgeStaleTokens().catch(() => {});
  } catch (err) {
    // 메일 발송 실패도 사용자에게는 드러내지 않는다 (열거 방지). 로그로만 남긴다.
    console.error("[reset] 재설정 메일 처리 실패:", err);
  }

  return SENT;
}

// ─── 새 비밀번호 설정 ─────────────────────────────────────────────────────

export interface ResetState {
  error?: string;
}

export async function submitNewPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password !== passwordConfirm) return { error: "비밀번호가 서로 다릅니다." };

  const pwError = validatePassword(password);
  if (pwError) return { error: pwError };

  const result = await consumeResetToken(token, password);
  if (!result.ok) {
    return {
      error:
        result.reason === "expired"
          ? "링크가 만료되었습니다. 재설정을 다시 요청해주세요."
          : result.reason === "used"
            ? "이미 사용된 링크입니다. 재설정을 다시 요청해주세요."
            : "유효하지 않은 링크입니다. 재설정을 다시 요청해주세요.",
    };
  }

  // 비밀번호가 바뀌었으니 로그인 실패 카운터도 풀어준다.
  const check = String(formData.get("email") ?? "");
  const email = normalizeEmail(check);
  if (email) clearLoginFailures(email);

  redirect("/signin?reset=1");
}
