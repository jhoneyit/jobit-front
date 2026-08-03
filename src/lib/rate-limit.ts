import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

/**
 * 스펙 §6 비용 통제: "세션당 호출 횟수 제한 + 결과 캐싱".
 *
 * 1단계는 로그인이 없으므로 익명 세션 쿠키를 키로 쓴다 (§2 인증: 초기 없음 → 익명 세션 쿠키).
 * 이 쿠키는 3단계에서 `resume.owner_key` 로 그대로 이어진다.
 *
 * 저장소는 메모리 — 단일 인스턴스 기준. 여러 인스턴스로 늘리면 Redis 나
 * Postgres 로 옮겨야 한다 (그 시점에 이 파일만 고치면 된다).
 */

export const SESSION_COOKIE = "jobit_sid";
const WINDOW_MS = 60 * 60 * 1000; // 1시간

interface Bucket {
  count: number;
  resetAt: number;
}

const g = globalThis as typeof globalThis & { __jobitRate?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__jobitRate ??= new Map());

function limitPerHour(): number {
  const raw = Number(process.env.RATE_LIMIT_PER_HOUR ?? "20");
  return Number.isFinite(raw) && raw >= 0 ? raw : 20;
}

/** 익명 세션 ID를 읽고, 없으면 새로 발급한다. */
export async function getOrCreateSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing) return existing;

  const sid = randomUUID();
  jar.set(SESSION_COOKIE, sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30일
  });
  return sid;
}

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number };

/**
 * 호출 1건을 소비한다. 캐시 적중처럼 LLM을 부르지 않는 경로에서는 호출하지 않는다
 * — 캐시가 있을수록 사용자가 덜 막히는 게 맞다.
 */
export function consume(sessionId: string): RateLimitResult {
  const limit = limitPerHour();
  if (limit === 0) return { allowed: true, remaining: Number.POSITIVE_INFINITY };

  const now = Date.now();
  const bucket = buckets.get(sessionId);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(sessionId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}

// ─── 로그인 시도 제한 (무차별 대입 방어) ──────────────────────────────────

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15분
const LOGIN_MAX_ATTEMPTS = 8;

const g2 = globalThis as typeof globalThis & { __jobitLogin?: Map<string, Bucket> };
const loginBuckets: Map<string, Bucket> = (g2.__jobitLogin ??= new Map());

/**
 * 로그인 실패를 누적해 무차별 대입을 늦춘다.
 *
 * 키는 **이메일 기준**이다. IP 기준은 NAT/모바일 환경에서 정상 사용자를 무더기로 막고,
 * 공격자는 IP 를 바꾸면 그만이라 실효가 적다. 대신 성공하면 즉시 초기화한다.
 *
 * 메모리 저장이라 인스턴스별로 센다 — 다중 인스턴스에서는 Redis 로 옮겨야 한다.
 */
export function checkLoginAttempts(email: string): RateLimitResult {
  const now = Date.now();
  const bucket = loginBuckets.get(email);

  if (!bucket || bucket.resetAt <= now) {
    return { allowed: true, remaining: LOGIN_MAX_ATTEMPTS };
  }
  if (bucket.count >= LOGIN_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, remaining: LOGIN_MAX_ATTEMPTS - bucket.count };
}

export function recordLoginFailure(email: string): void {
  const now = Date.now();
  const bucket = loginBuckets.get(email);
  if (!bucket || bucket.resetAt <= now) {
    loginBuckets.set(email, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    bucket.count += 1;
  }
}

export function clearLoginFailures(email: string): void {
  loginBuckets.delete(email);
}

// ─── 비밀번호 재설정 요청 제한 ────────────────────────────────────────────

const RESET_WINDOW_MS = 60 * 60 * 1000; // 1시간
const RESET_MAX_REQUESTS = 5;

const g3 = globalThis as typeof globalThis & { __jobitReset?: Map<string, Bucket> };
const resetBuckets: Map<string, Bucket> = (g3.__jobitReset ??= new Map());

/**
 * 재설정 메일 폭탄 방지 — 같은 주소로 계속 요청해 남의 메일함을 채우는 걸 막는다.
 *
 * 한도를 넘겨도 **사용자에게는 성공했을 때와 똑같은 화면을 보여준다.**
 * "요청이 너무 많습니다"를 노출하면 그 자체로 가입된 이메일임을 알려주는 셈이다.
 */
export function consumeResetRequest(email: string): boolean {
  const now = Date.now();
  const bucket = resetBuckets.get(email);

  if (!bucket || bucket.resetAt <= now) {
    resetBuckets.set(email, { count: 1, resetAt: now + RESET_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RESET_MAX_REQUESTS) return false;

  bucket.count += 1;
  return true;
}
