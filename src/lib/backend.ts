/**
 * `jobit` (Spring) 백엔드 호출.
 *
 * 2026-08-04 이관: 도메인 로직·LLM 호출은 저쪽이 갖고, 이 레포는 화면과 인증만 맡는다.
 * 여기가 두 레포 사이의 **유일한 통로**다 — 새 엔드포인트를 부를 때도 이 파일을 거친다.
 *
 * **인증 헤더는 없다.** 인증은 이 레포(Auth.js)가 하고, 백엔드에는 결과인 `owner_key` 만
 * 넘긴다. 그래서 백엔드는 자격증명을 보지 않는다 (`jobit/CLAUDE.md` 경계 참고).
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

export async function backendFetch(
  path: string,
  init: RequestInit & { ownerKey?: string | null } = {},
): Promise<Response> {
  const { ownerKey, headers, ...rest } = init;

  const res = await fetch(`${baseUrl()}${path}`, {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...(ownerKey ? { "X-Owner-Key": ownerKey } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
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
 * `ApiExceptionHandler` 가 `{ "message": ... }` 형태로 내려주지만, 프록시나 게이트웨이가
 * 끼어들면 JSON 이 아닐 수 있다. 그때 본문을 그대로 노출하면 스택트레이스가 화면에 뜬다.
 */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown; error?: unknown };
    const msg = body.message ?? body.error;
    if (typeof msg === "string" && msg.trim()) return msg;
  } catch {
    // JSON 이 아니면 아래 기본 문구로 떨어진다.
  }
  return res.status === 429
    ? "요청이 몰려 잠시 처리할 수 없습니다. 잠시 후 다시 시도해 주세요."
    : "공고 분석 중 오류가 발생했습니다.";
}
