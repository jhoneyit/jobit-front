"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";
import { createDbSession, revokeAllSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export interface AccountState {
  error?: string;
  success?: string;
}

/**
 * 로그인 상태에서 비밀번호를 바꾸거나 새로 설정한다.
 *
 *  - 이미 비밀번호가 있으면 **현재 비밀번호를 반드시 확인한다.**
 *    세션만으로 허용하면 남의 자리에 앉은 사람이 비밀번호를 바꿔 계정을 뺏을 수 있다.
 *  - GitHub 로만 가입해 비밀번호가 없으면 현재 비밀번호를 묻지 않고 새로 설정한다.
 *
 * userId 는 인자로 받지 않고 세션에서 읽는다 — Server Action 은 공개 엔드포인트다.
 */
export async function changePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "로그인이 필요합니다." };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("passwordConfirm") ?? "");

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { error: "계정을 찾을 수 없습니다." };

  const hasPassword = Boolean(user.passwordHash);

  if (hasPassword) {
    if (!current) return { error: "현재 비밀번호를 입력해주세요." };
    if (!(await verifyPassword(current, user.passwordHash))) {
      return { error: "현재 비밀번호가 올바르지 않습니다." };
    }
    if (current === next) {
      return { error: "현재 비밀번호와 다른 비밀번호를 사용해주세요." };
    }
  }

  if (next !== confirm) return { error: "새 비밀번호가 서로 다릅니다." };

  const pwError = validatePassword(next);
  if (pwError) return { error: pwError };

  const passwordHash = await hashPassword(next);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  // 다른 기기의 세션은 끊고, 지금 쓰는 브라우저만 새 세션으로 이어 준다.
  await revokeAllSessions(userId);
  await createDbSession(userId);

  revalidatePath("/account");
  return {
    success: hasPassword
      ? "비밀번호를 변경했습니다. 다른 기기에서는 다시 로그인해야 합니다."
      : "비밀번호를 설정했습니다. 이제 이메일로도 로그인할 수 있습니다.",
  };
}
