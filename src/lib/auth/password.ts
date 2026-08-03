import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * `promisify(scrypt)` 는 options 를 받는 오버로드를 잃어버려서(TS2554) 직접 감싼다.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) =>
      err ? reject(err) : resolve(derived),
    );
  });
}

/**
 * 비밀번호 해싱 — Node 내장 scrypt.
 *
 * bcrypt/argon2 는 네이티브 빌드가 필요해 배포 환경마다 말썽이 난다. scrypt 는 Node 표준
 * 라이브러리에 있고 메모리 하드 함수라 GPU 무차별 대입에 강하다.
 *
 * N=2^15, r=8, p=1 → 약 32MB 메모리 / 호출당 수십 ms.
 * Node 의 기본 maxmem(32MB)으로는 이 파라미터가 안 돌아가므로 명시적으로 올려 준다.
 */
const N = 2 ** 15;
const r = 8;
const p = 1;
const KEY_LEN = 64;
const MAXMEM = 128 * 1024 * 1024;
const SALT_LEN = 16;

/** 저장 형식: scrypt$N$r$p$<salt base64>$<hash base64> — 나중에 파라미터를 올려도 기존 해시를 읽을 수 있다. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const hash = await scryptAsync(plain.normalize("NFKC"), salt, KEY_LEN, {
    N,
    r,
    p,
    maxmem: MAXMEM,
  });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** 상수 시간 비교. 형식이 깨졌거나 해시가 없으면 false. */
export async function verifyPassword(
  plain: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");

  let actual: Buffer;
  try {
    actual = await scryptAsync(plain.normalize("NFKC"), salt, expected.length, {
      N: Number(nStr),
      r: Number(rStr),
      p: Number(pStr),
      maxmem: MAXMEM,
    });
  } catch {
    return false;
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ─── 입력 검증 ────────────────────────────────────────────────────────────

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

/**
 * 비밀번호 정책.
 *
 * 특수문자·대문자 강제 같은 규칙은 넣지 않는다. 사용자를 `Password1!` 로 몰아갈 뿐
 * 실제 엔트로피는 길이에서 나온다. 대신 최소 10자를 요구하고, 뻔한 것만 막는다.
 */
export function validatePassword(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  }
  if (pw.length > MAX_PASSWORD_LENGTH) {
    return `비밀번호는 ${MAX_PASSWORD_LENGTH}자를 넘을 수 없습니다.`;
  }
  if (/^\d+$/.test(pw)) {
    return "숫자로만 이루어진 비밀번호는 사용할 수 없습니다.";
  }
  const lowered = pw.toLowerCase();
  const banned = ["password", "qwerty", "111111", "123456", "letmein", "iloveyou"];
  if (banned.some((b) => lowered.includes(b))) {
    return "너무 흔한 비밀번호입니다. 다른 것을 사용해주세요.";
  }
  return null;
}

/** 지나치게 엄격한 정규식은 정상 주소를 막는다. 형태만 최소한으로 본다. */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}
