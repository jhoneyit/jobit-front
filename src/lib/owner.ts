import { cookies } from "next/headers";
import { auth } from "@/auth";
import { SESSION_COOKIE } from "@/lib/rate-limit";

/**
 * `owner_key` 규약 — 스펙 §3.3 의 "익명 세션 키 또는 user_id" 를 하나의 문자열로 표현한다.
 *
 *   로그인함   → "user:<userId>"
 *   비로그인   → "anon:<익명 세션 쿠키>"
 *
 * 접두사를 붙여 두면 두 네임스페이스가 절대 충돌하지 않고, 조회 쿼리는
 * owner_key 하나만 보면 되므로 로그인 여부에 따라 분기할 필요가 없다.
 * 3단계에서 `resume.owner_key` 도 같은 함수를 쓴다.
 */

export function userOwnerKey(userId: string): string {
  return `user:${userId}`;
}

export function anonOwnerKey(sessionId: string): string {
  return `anon:${sessionId}`;
}

/** 서버 컴포넌트에서도 안전한 읽기 전용 조회. 쿠키를 새로 발급하지 않는다. */
export async function readAnonSessionId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export interface Owner {
  key: string;
  userId: string | null;
  isLoggedIn: boolean;
}

/**
 * 현재 요청의 소유자. 서버 컴포넌트/route handler 양쪽에서 쓸 수 있다.
 * 익명이고 쿠키도 아직 없으면 null — 아직 아무것도 제출하지 않은 방문자다.
 */
export async function currentOwner(): Promise<Owner | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (userId) {
    return { key: userOwnerKey(userId), userId, isLoggedIn: true };
  }

  const anon = await readAnonSessionId();
  if (!anon) return null;

  return { key: anonOwnerKey(anon), userId: null, isLoggedIn: false };
}
