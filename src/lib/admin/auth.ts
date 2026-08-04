import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * 관리자 콘솔 인증.
 *
 * **Auth.js 를 쓰지 않는다.** 관리자는 서비스 사용자가 아니다 — `user` 테이블에 행을 만들면
 * 통계(가입자 수, 제출 이력)에 관리자가 섞이고, 세션이 섞이면 "로그아웃했는데 관리자만 풀린다"
 * 같은 혼선이 생긴다. 그래서 사용자 세션과 완전히 분리된 서명 쿠키 하나로 끝낸다.
 *
 * 서명은 `AUTH_SECRET` 기반 HMAC 이다. DB 도 안 타고 상태도 없어서, 이 파일 하나만 지우면
 * 관리자 기능이 통째로 사라진다 — `jobit` 서버로 이관할 때 걷어내기 쉬우라고 이렇게 뒀다.
 */

const COOKIE = "jobit_admin";

/** 쿠키를 /admin 에만 보낸다. 사용자 화면 요청에는 실려 나가지 않는다. */
const COOKIE_PATH = "/admin";

const MAX_AGE_SEC = 60 * 60 * 8; // 8시간

const DEFAULT_USER = "admin";

const DEFAULT_PASSWORD = "admin";

export const adminUser = () => process.env.ADMIN_USER || DEFAULT_USER;

const adminPassword = () => process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;

/** 기본 비밀번호를 그대로 쓰고 있는가. 화면에 경고를 띄우는 데 쓴다. */
export function usingDefaultPassword(): boolean {
  return !process.env.ADMIN_PASSWORD;
}

/**
 * 운영에서 기본 비밀번호로는 열리지 않는다.
 *
 * `admin/admin` 은 로컬 확인용이다. 이 판정이 없으면 배포하는 순간 아무나 전체 제출 이력과
 * 사용자 목록을 볼 수 있다. `/api/cost` 가 운영에서 404 를 내는 것과 같은 취지인데,
 * 여기서는 **비밀번호를 제대로 설정했다면 운영에서도 쓸 수 있게** 조건부로 막는다.
 */
export function adminDisabled(): boolean {
  return process.env.NODE_ENV === "production" && usingDefaultPassword();
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error(
      "AUTH_SECRET 이 없습니다. 관리자 세션 쿠키 서명에 필요합니다 — .env.local 을 확인해 주세요.",
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** 길이가 달라도 예외 없이 false 를 주는 상수시간 비교. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkCredentials(user: string, password: string): boolean {
  // 둘 다 확인해야 한다. || 로 단축하면 아이디가 틀렸을 때 비밀번호 비교를 건너뛰어
  // 응답 시간으로 "아이디는 맞았는지"가 새어 나간다.
  const okUser = safeEqual(user, adminUser());
  const okPassword = safeEqual(password, adminPassword());
  return okUser && okPassword;
}

/** 로그인 쿠키를 심는다. Server Action 에서만 호출 가능. */
export async function startAdminSession(): Promise<void> {
  const expiresAt = Date.now() + MAX_AGE_SEC * 1000;
  const value = `${expiresAt}.${sign(String(expiresAt))}`;

  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge: MAX_AGE_SEC,
  });
}

export async function endAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: COOKIE, path: COOKIE_PATH });
}

/**
 * 쿠키가 유효한가.
 *
 * 만료 시각을 쿠키 안에 넣고 **그 값까지 서명에 포함**한다. 만료를 브라우저의 `maxAge` 에만
 * 맡기면 쿠키를 손으로 되살릴 수 있다.
 */
export async function isAdminAuthed(): Promise<boolean> {
  if (adminDisabled()) return false;

  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;

  const dot = raw.indexOf(".");
  if (dot < 0) return false;

  const expiresAt = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  if (!safeEqual(signature, sign(expiresAt))) return false;

  const ms = Number(expiresAt);
  return Number.isFinite(ms) && ms > Date.now();
}
