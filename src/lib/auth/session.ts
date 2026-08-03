import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";

/**
 * DB 세션을 직접 발급/폐기한다.
 *
 * **왜 Auth.js 의 Credentials provider 를 쓰지 않는가:**
 * @auth/core 의 credentials 처리 경로(`lib/actions/callback/index.js`)는
 * `session.strategy` 가 "database" 여도 무조건 JWT 를 만들어 세션 쿠키에 넣는다 —
 * `adapter.createSession` 을 호출하지 않는다. 그 상태로 `auth()` 를 부르면
 * DB 전략이라 세션 토큰으로 session 테이블을 조회하고, JWT 문자열은 어느 행에도 맞지 않아
 * **로그인은 성공했는데 로그아웃 상태로 보이는** 증상이 난다.
 *
 * 그래서 credentials 로그인만 Auth.js 를 우회해 세션 행을 직접 만든다.
 * 세션 테이블·쿠키 이름은 Auth.js 규약을 그대로 따르므로, `auth()` 조회와
 * `signOut()` 폐기는 GitHub 로그인과 완전히 동일하게 동작한다.
 */

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30일

/**
 * Auth.js 는 쿠키 이름 접두사를 요청 URL 프로토콜로 정한다
 * (`@auth/core/lib/init.js`: `useSecureCookies ?? url.protocol === "https:"`).
 * 같은 판정을 재현해야 이름이 어긋나지 않는다.
 */
async function sessionCookieName(): Promise<string> {
  const h = await headers();
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (process.env.AUTH_URL?.startsWith("https:") ? "https" : "http");
  return proto === "https" ? "__Secure-authjs.session-token" : "authjs.session-token";
}

/** 세션 행을 만들고 쿠키를 심는다. Server Action / route handler 에서만 호출 가능. */
export async function createDbSession(userId: string): Promise<void> {
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000);

  await db.insert(sessions).values({ sessionToken, userId, expires });

  const name = await sessionCookieName();
  const jar = await cookies();
  jar.set(name, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: name.startsWith("__Secure-"),
    path: "/",
    expires,
  });
}

/**
 * 로그인 시 기존 세션을 모두 끊는다.
 *
 * 비밀번호를 아는 사람이 로그인하면 이전 세션은 정리하는 편이 안전하다 —
 * 비밀번호 변경 후 탈취된 세션이 남아 있는 상황을 막는다.
 * (다중 기기 동시 로그인이 필요해지면 이 호출만 빼면 된다.)
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
