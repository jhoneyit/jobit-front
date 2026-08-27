import { createHmac } from "node:crypto";

/**
 * `jobit` (Spring) 백엔드 호출.
 *
 * 2026-08-04 이관: 도메인 로직·LLM 호출은 저쪽이 갖고, 이 레포는 화면과 인증만 맡는다.
 * 여기가 두 레포 사이의 **유일한 통로**다 — 새 엔드포인트를 부를 때도 이 파일을 거친다.
 *
 * **사용자 자격증명은 넘기지 않는다.** 로그인 판단은 이 레포(Auth.js)가 하고, 백엔드에는
 * 결과인 `owner_key` 만 넘긴다 (`jobit/CLAUDE.md` 경계 참고).
 *
 * **다만 그 `owner_key` 에 서명을 붙인다.** 백엔드는 그 값을 그대로 믿고 소유자를 판단하므로,
 * 서명이 없으면 8080 을 직접 때리는 것만으로 남의 기록을 읽을 수 있다. 서명은 특정
 * `owner_key` 와 만료 시각에 묶여 있어, 요청 하나가 새어 나가도 그 사람으로 만료 전까지만
 * 쓸 수 있다 — 공유 토큰 하나면 새는 순간 모든 소유자를 사칭할 수 있다.
 *
 * **서명은 서버에서만 만든다.** `node:crypto` 와 `JOBIT_SERVICE_SECRET` 을 쓰므로 이 모듈은
 * 클라이언트 번들에 들어갈 수 없고, 들어가려 하면 빌드가 깨진다 — 비밀키가 브라우저로
 * 새는 사고를 타입이 아니라 번들러가 막는다.
 */

/** 백엔드가 문구까지 정해 내려주는 오류. 그대로 사용자에게 보여도 되는 값이다. */
export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

function baseUrl(): string {
  const url = process.env.JOBIT_API_URL;
  if (!url) {
    throw new BackendError(
      "JOBIT_API_URL 이 설정되지 않았습니다. .env.local 을 확인해 주세요.",
      500,
    );
  }
  return url.replace(/\/$/, "");
}

/**
 * LLM 호출이 뒤에 있어 오래 걸린다. 기본 fetch 타임아웃에 기대지 않고 명시한다 —
 * 걸리지 않으면 백엔드가 죽었을 때 요청이 무한정 매달린다.
 */
const TIMEOUT_MS = 120_000;

/**
 * 서명 유효 시간. 짧을수록 새어 나간 헤더의 수명이 짧지만, 백엔드가 5초짜리 요청을 받는
 * 사이 만료되면 안 된다. LLM 호출이 뒤에 있어도 **서명은 요청이 도착할 때 검증되므로**
 * 응답 시간이 아니라 네트워크 지연만 감당하면 된다.
 */
const SIGNATURE_TTL_SECONDS = 120;

/**
 * `owner_key` + 만료 시각에 HMAC 서명을 건다. 백엔드 `ServiceAuth` 와 같은 규약이다.
 *
 * **`owner_key` 가 없는 요청도 서명한다** (예: 공개 통계). 서명 없는 호출을 통과시키는
 * 예외를 두면 그 경로가 그대로 뒷문이 된다.
 *
 * 비밀키가 없으면 헤더를 붙이지 않는다 — 백엔드도 같은 조건에서 인증을 끄므로 로컬에서
 * 설정 없이 그대로 돌아간다. 한쪽만 설정하면 401 이 나는데, 그게 조용히 열려 있는 것보다 낫다.
 */
function signOwnerKey(ownerKey: string | null | undefined): string | null {
  const secret = process.env.JOBIT_SERVICE_SECRET;
  if (!secret) return null;

  const exp = Math.floor(Date.now() / 1000) + SIGNATURE_TTL_SECONDS;
  // 버전과 만료를 서명 **안에** 넣는다. 밖에 두면 만료를 늘려 무기한 재사용할 수 있다.
  const payload = `v1.${ownerKey ?? ""}.${exp}`;
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `v1.${exp}.${signature}`;
}

export async function backendFetch(
  path: string,
  init: RequestInit & { ownerKey?: string | null; timeoutMs?: number } = {},
): Promise<Response> {
  // timeoutMs 는 응답 본문을 다 읽을 때까지의 상한이다 — 스트리밍(SSE)은 연결이 분 단위로
  // 살아 있으므로 기본 120초로는 중간에 끊긴다. 스트리밍 호출부만 넉넉히 넘긴다.
  const { ownerKey, headers, timeoutMs, ...rest } = init;
  const signature = signOwnerKey(ownerKey);

  const res = await fetch(`${baseUrl()}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(ownerKey ? { "X-Owner-Key": ownerKey } : {}),
      ...(signature ? { "X-Owner-Auth": signature } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(timeoutMs ?? TIMEOUT_MS),
    // 백엔드 응답은 사용자·시점마다 다르다. Next 의 기본 캐시를 타면 안 된다.
    cache: "no-store",
  }).catch((err: unknown) => {
    // 연결 자체가 실패한 경우 — 백엔드가 안 떠 있을 때 가장 흔하다.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[backend] 연결 실패:", detail);
    throw new BackendError(
      "분석 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      502,
    );
  });

  if (!res.ok) {
    throw new BackendError(await errorMessage(res), res.status);
  }
  return res;
}

/**
 * 백엔드의 오류 문구를 꺼낸다.
 *
 * `ApiExceptionHandler` 는 `{ "error": ... }` 하나로 통일해 내려준다 (`jobit/docs/api.md`).
 * `message` 도 함께 보는 것은 방어용이다 — 프록시나 게이트웨이가 끼어들면 형태가 달라진다.
 * JSON 이 아닐 때 본문을 그대로 노출하면 스택트레이스가 화면에 뜨므로 기본 문구로 떨어뜨린다.
 */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown; error?: unknown };
    const msg = body.error ?? body.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  } catch {
    // JSON 이 아니면 아래 기본 문구로 떨어진다.
  }
  if (res.status === 429) {
    return "요청이 몰려 잠시 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (res.status === 401) {
    // 두 레포의 JOBIT_SERVICE_SECRET 이 다르거나 한쪽만 설정된 상태다. 사용자가 할 수 있는
    // 일이 없으므로 문구는 뭉뚱그리되, 서버 로그에는 원인을 정확히 남긴다.
    console.error(
      "[backend] 호출자 인증 실패 — jobit 과 JOBIT_SERVICE_SECRET 이 같은 값인지 확인하세요.",
    );
    return "서버 설정 문제로 요청을 처리하지 못했습니다.";
  }
  return "공고 분석 중 오류가 발생했습니다.";
}
