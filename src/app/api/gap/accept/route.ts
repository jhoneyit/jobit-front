import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { setSuggestionAccepted } from "@/lib/gap";
import { currentOwner } from "@/lib/owner";

export const runtime = "nodejs";

/**
 * POST /api/gap/accept
 * body: { suggestionId: string, accepted: boolean }
 *
 * 채택 여부 기록 — 품질 지표다 (스펙 §3.4). 백엔드에는 PATCH 로 나가지만, 이 레포의
 * route handler 들은 브라우저 호출을 전부 POST 로 받는다 (한 파일 = 한 동작 관례).
 */
export async function POST(req: Request) {
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "먼저 공고를 분석해 주세요." },
      { status: 400 },
    );
  }

  let body: { suggestionId?: unknown; accepted?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  if (typeof body.suggestionId !== "string" || typeof body.accepted !== "boolean") {
    return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await setSuggestionAccepted(owner.key, body.suggestionId, body.accepted),
    );
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[gap/accept] 예상치 못한 오류:", err);
    return NextResponse.json(
      { error: "채택 여부를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
