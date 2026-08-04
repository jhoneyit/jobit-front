import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { BackendError, backendFetch } from "@/lib/backend";
import { validateAndNormalize } from "@/lib/jd/normalize";
import { anonOwnerKey, userOwnerKey } from "@/lib/owner";
import { getOrCreateSessionId } from "@/lib/rate-limit";
import type { ParseJdResponse, Requirement } from "@/lib/types";

// 백엔드의 LLM 호출이 길게 돌기 때문에 Node 런타임 + 넉넉한 실행시간.
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/jd/parse
 * body: { text: string, sourceUrl?: string }
 *
 * **2026-08-04 이관: 파싱 자체는 `jobit` 백엔드가 한다.** 이 라우트에 남은 일은
 * 이 레포만 할 수 있는 것들뿐이다 — 세션에서 `owner_key` 를 뽑고, 세션 기준 레이트 리밋을
 * 걸고, 백엔드 응답을 화면이 쓰는 형태로 옮긴다.
 *
 * 정규화를 여기서도 한 번 하는 이유는 100자 미만 같은 명백한 입력을 백엔드까지 보내지 않고
 * 즉시 400 으로 끊기 위해서다. 진짜 정규화·해시·캐시는 백엔드가 다시 한다.
 *
 * **레이트 리밋도 백엔드가 건다** (jobit LlmGuard). 두 곳에서 각자 세면 실질 한도가 어긋나고,
 * 캐시 적중 판정이 이쪽에 없어 적중까지 소비하게 된다.
 */
export async function POST(req: Request) {
  let body: { text?: unknown; sourceUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const validation = validateAndNormalize(body.text as string);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const sessionId = await getOrCreateSessionId();

  // 소유자 결정 — 로그인했으면 user:<id>, 아니면 anon:<세션쿠키> (§3.3 owner_key 규약).
  // 인증이 이 레포에 남으므로 이 판단도 여기서만 할 수 있다.
  const session = await auth();
  const ownerKey = session?.user?.id
    ? userOwnerKey(session.user.id)
    : anonOwnerKey(sessionId);

  try {
    const res = await backendFetch("/api/jd/parse", {
      method: "POST",
      ownerKey,
      body: JSON.stringify({
        text: validation.normalized,
        sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
      }),
    });

    return NextResponse.json(toParseJdResponse(await res.json()));
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[jd/parse] 예상치 못한 오류:", err);
    return NextResponse.json(
      { error: "공고 분석 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

/**
 * 백엔드 `JdParseResult` → 화면이 쓰는 `ParseJdResponse`.
 *
 * 차이가 둘 있다. `cached` 와 `cacheHit` 로 이름이 다르고, 백엔드의 `RequirementView` 에는
 * `jobPostingId` 가 없다 — 요청 단위로 이미 아는 값이라 굳이 실어 보내지 않는다.
 * 여기서 채워 넣어 화면 타입을 그대로 유지한다.
 */
interface BackendParseResult {
  jobPostingId: string;
  parsed: ParseJdResponse["parsed"];
  cached: boolean;
  requirements: Omit<Requirement, "jobPostingId">[];
}

function toParseJdResponse(raw: unknown): ParseJdResponse {
  const r = raw as BackendParseResult;
  return {
    jobPostingId: r.jobPostingId,
    parsed: r.parsed,
    cacheHit: r.cached,
    requirements: r.requirements.map((q) => ({ ...q, jobPostingId: r.jobPostingId })),
  };
}
