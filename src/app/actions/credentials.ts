"use server";

import { redirect } from "next/navigation";
import { createUserWithPassword, verifyCredentials } from "@/lib/auth/credentials";
import { normalizeEmail, validatePassword } from "@/lib/auth/password";
import { createDbSession, revokeAllSessions } from "@/lib/auth/session";
import {
  checkLoginAttempts,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/rate-limit";

export interface FormState {
  error?: string;
  /** 값을 다시 채워 주기 위한 것. 비밀번호는 절대 돌려보내지 않는다. */
  email?: string;
  name?: string;
}

/** 열린 리디렉션 방지 — 우리 사이트 내부 경로만 허용한다. */
function safeCallback(raw: FormDataEntryValue | null): string {
  const v = typeof raw === "string" ? raw : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/profile/history";
}

// ─── 회원가입 ─────────────────────────────────────────────────────────────

export async function signUpWithPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawEmail = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const callbackUrl = safeCallback(formData.get("callbackUrl"));

  const echo = { email: rawEmail, name: name ?? undefined };

  const email = normalizeEmail(rawEmail);
  if (!email) return { ...echo, error: "이메일 형식이 올바르지 않습니다." };

  if (password !== passwordConfirm) {
    return { ...echo, error: "비밀번호가 서로 다릅니다." };
  }

  const pwError = validatePassword(password);
  if (pwError) return { ...echo, error: pwError };

  if (name && name.length > 50) {
    return { ...echo, error: "이름은 50자를 넘을 수 없습니다." };
  }

  const result = await createUserWithPassword({ email, password, name });
  if (!result.ok) return { ...echo, error: result.error };

  // 가입 즉시 로그인시킨다 — 방금 비밀번호를 입력한 사람이므로 한 번 더 물을 이유가 없다.
  await createDbSession(result.userId);

  redirect(callbackUrl);
}

// ─── 로그인 ───────────────────────────────────────────────────────────────

export async function signInWithPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawEmail = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = safeCallback(formData.get("callbackUrl"));

  const email = normalizeEmail(rawEmail);
  // 형식이 틀려도 "이메일 또는 비밀번호가..." 로 뭉뚱그린다 (계정 열거 방지)
  if (!email) {
    return { email: rawEmail, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  const throttle = checkLoginAttempts(email);
  if (!throttle.allowed) {
    return {
      email: rawEmail,
      error: `로그인 시도가 너무 많습니다. ${Math.ceil(throttle.retryAfterSec / 60)}분 뒤에 다시 시도해주세요.`,
    };
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    recordLoginFailure(email);
    return { email: rawEmail, error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  clearLoginFailures(email);
  await revokeAllSessions(user.userId);
  await createDbSession(user.userId);

  redirect(callbackUrl);
}
