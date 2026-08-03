import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseJd } from "@/lib/jd/parse";
import { validateAndNormalize } from "@/lib/jd/normalize";
import { LlmError } from "@/lib/llm/client";
import { anonOwnerKey, userOwnerKey } from "@/lib/owner";
import { consume, getOrCreateSessionId } from "@/lib/rate-limit";
import { findJobPostingByHash } from "@/lib/store";

// LLM 호출이 길게 돌기 때문에 Node 런타임 + 넉넉한 실행시간.
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/jd/parse
 * body: { text: string, sourceUrl?: string }
 *
 * 스펙 §4.1 의 진입점. 정규화 → 해시 → 캐시 조회 → (없으면) LLM 호출.
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

  // 소유자 결정 — 로그인했으면 user:<id>, 아니면 anon:<세션쿠키> (§3.3 owner_key 규약)
  const session = await auth();
  const ownerKey = session?.user?.id
    ? userOwnerKey(session.user.id)
    : anonOwnerKey(sessionId);

  // 캐시에 있으면 LLM 을 부르지 않으므로 레이트 리밋도 소비하지 않는다.
  const alreadyCached = (await findJobPostingByHash(validation.hash)) !== null;
  if (!alreadyCached) {
    const rate = consume(sessionId);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `요청 한도를 초과했습니다. ${Math.ceil(rate.retryAfterSec / 60)}분 뒤에 다시 시도해주세요.`,
        },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }
  }

  try {
    const result = await parseJd({
      normalized: validation.normalized,
      hash: validation.hash,
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
      ownerKey,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LlmError) {
      const status =
        err.kind === "CONFIG" ? 500 : err.kind === "RATE_LIMIT" ? 429 : 502;
      console.error(`[jd/parse] ${err.kind}:`, err.cause ?? err.message);
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[jd/parse] 예상치 못한 오류:", err);
    return NextResponse.json(
      { error: "공고 분석 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
