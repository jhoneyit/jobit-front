import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";

export const RESET_TTL_MIN = 30;

/**
 * 토큰은 32바이트 난수(base64url). DB 에는 SHA-256 만 저장한다.
 *
 * 비밀번호와 달리 느린 해시(scrypt)를 쓰지 않는 이유: 토큰은 256비트 난수라
 * 사전 공격 대상이 아니고, 링크 클릭마다 검증하므로 빨라야 한다.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * 재설정 토큰 발급.
 *
 * 발급 시 그 사용자의 기존 미사용 토큰을 모두 무효화한다 —
 * 여러 링크가 동시에 살아 있으면 가장 오래된 메일이 유출됐을 때도 계속 유효해진다.
 */
export async function issueResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60_000);

  await db.transaction(async (tx) => {
    await tx
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

    await tx.insert(passwordResetTokens).values({
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    });
  });

  return token;
}

export type TokenCheck =
  | { valid: true; userId: string; email: string | null }
  | { valid: false; reason: "invalid" | "expired" | "used" };

/** 토큰 확인만 한다 (소비하지 않음). 재설정 폼을 그릴지 판단하는 용도. */
export async function checkResetToken(token: string): Promise<TokenCheck> {
  if (!token) return { valid: false, reason: "invalid" };

  const [row] = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
      usedAt: passwordResetTokens.usedAt,
      tokenHash: passwordResetTokens.tokenHash,
      email: users.email,
    })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(eq(passwordResetTokens.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) return { valid: false, reason: "invalid" };

  // unique 인덱스로 찾았지만, 해시 비교는 상수 시간으로 한 번 더 확인한다.
  const a = Buffer.from(row.tokenHash, "hex");
  const b = Buffer.from(hashToken(token), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "invalid" };
  }

  if (row.usedAt) return { valid: false, reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { valid: false, reason: "expired" };

  return { valid: true, userId: row.userId, email: row.email };
}

export type ResetOutcome =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/**
 * 토큰을 소비하고 비밀번호를 바꾼다.
 *
 * 트랜잭션 안에서 `used_at IS NULL` 조건으로 UPDATE 하므로, 같은 링크를 두 번 눌러도
 * 두 번째는 0행이 갱신돼 실패한다 (경합 안전).
 *
 * 성공하면 **그 사용자의 모든 세션을 끊는다.** 비밀번호를 재설정하는 상황은
 * 계정이 이미 털렸을 가능성을 전제하므로, 남아 있는 세션을 살려 두면 재설정이 무의미하다.
 */
export async function consumeResetToken(
  token: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const check = await checkResetToken(token);
  if (!check.valid) return { ok: false, reason: check.reason };

  const passwordHash = await hashPassword(newPassword);

  const claimed = await db.transaction(async (tx) => {
    const updated = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, hashToken(token)),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });

    if (updated.length === 0) return null; // 다른 요청이 먼저 썼다

    await tx
      .update(users)
      .set({
        passwordHash,
        // 재설정 링크를 열었다는 건 그 주소를 통제한다는 뜻이다 — 이메일 인증으로 인정한다.
        emailVerified: new Date(),
      })
      .where(eq(users.id, updated[0].userId));

    return updated[0].userId;
  });

  if (!claimed) return { ok: false, reason: "used" };

  await revokeAllSessions(claimed);
  return { ok: true };
}

/** 만료·사용 완료 토큰 청소. 크론이 붙기 전까지는 발급 시점에 곁다리로 부른다. */
export async function purgeStaleTokens(): Promise<void> {
  await db
    .delete(passwordResetTokens)
    .where(
      or(
        lt(passwordResetTokens.expiresAt, new Date()),
        lt(passwordResetTokens.usedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      ),
    );
}
