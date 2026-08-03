import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

/**
 * 이메일+비밀번호 계정 조회/생성.
 *
 * 스펙 §2 는 GitHub OAuth 만 정의한다. 이 모듈은 그 위에 얹은 추가 경로이고,
 * 같은 `user` 테이블을 쓰므로 어느 쪽으로 가입하든 owner_key 규약(`user:<id>`)은 동일하다.
 */

export type SignUpResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function createUserWithPassword(args: {
  email: string;
  password: string;
  name: string | null;
}): Promise<SignUpResult> {
  const existing = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, args.email))
    .limit(1);

  if (existing.length > 0) {
    // 이미 GitHub 로 가입한 이메일이면 그 사실을 알려 준다.
    // 여기서 자동으로 계정을 합치지 않는 이유: 이메일 소유를 아직 검증하지 않았으므로,
    // 남의 GitHub 계정 이메일로 비밀번호를 걸어 버릴 수 있다.
    const linked = await db
      .select({ provider: accounts.provider })
      .from(accounts)
      .where(eq(accounts.userId, existing[0].id))
      .limit(1);

    if (linked.length > 0 && !existing[0].passwordHash) {
      return {
        ok: false,
        error: `이미 ${linked[0].provider} 계정으로 가입된 이메일입니다. 해당 방식으로 로그인해주세요.`,
      };
    }
    return { ok: false, error: "이미 가입된 이메일입니다." };
  }

  const passwordHash = await hashPassword(args.password);

  try {
    const [created] = await db
      .insert(users)
      .values({ email: args.email, name: args.name, passwordHash })
      .returning({ id: users.id });
    return { ok: true, userId: created.id };
  } catch {
    // email unique 경합 — 위 조회와 INSERT 사이에 다른 요청이 먼저 들어온 경우
    return { ok: false, error: "이미 가입된 이메일입니다." };
  }
}

/**
 * 자격 증명 확인.
 *
 * 이메일이 없든 비밀번호가 틀리든 **같은 결과·비슷한 소요시간**을 돌려준다.
 * 그러지 않으면 응답 차이로 가입된 이메일 목록을 알아낼 수 있다(계정 열거).
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<{ userId: string; name: string | null } | null> {
  const [row] = await db
    .select({ id: users.id, name: users.name, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // 사용자가 없어도 해싱 비용을 동일하게 치러 타이밍 차이를 줄인다.
  const ok = await verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);

  if (!row || !row.passwordHash || !ok) return null;
  return { userId: row.id, name: row.name };
}

/**
 * 존재하지 않는 계정에도 실제와 같은 검증 비용을 치르기 위한 더미 해시.
 * 어떤 비밀번호와도 일치하지 않는다.
 */
const DUMMY_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
