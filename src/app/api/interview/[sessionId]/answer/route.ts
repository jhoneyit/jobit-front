import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { submitAnswer } from "@/lib/interviews";
import { currentOwner } from "@/lib/owner";

// 채점에 LLM 호출이 들어 있어 몇 초가 걸린다 (실측 6.6초).
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/interview/{sessionId}/answer
 * body: { questionId: string, transcript: string, durationMs: number }
 *
 * **`transcript` 가 비어 있는 것은 오류가 아니다.** 제한 시간 안에 한마디도 못 한 경우가 정상
 * 경로이고 그 자체가 결과다 — 백엔드가 LLM 을 부르지 않고 0점으로 기록한다.
 *
 * **오디오는 여기로 오지 않는다.** 브라우저가 인식한 텍스트만 온다.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ error: "세션이 만료되었습니다." }, { status: 400 });
  }

  const { sessionId } = await params;

  let body: { questionId?: unknown; transcript?: unknown; durationMs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  if (typeof body.questionId !== "string") {
    return NextResponse.json({ error: "질문을 선택해 주세요." }, { status: 400 });
  }

  try {
    const scored = await submitAnswer(owner.key, sessionId, {
      questionId: body.questionId,
      transcript: typeof body.transcript === "string" ? body.transcript : "",
      durationMs:
        typeof body.durationMs === "number" && Number.isFinite(body.durationMs)
          ? Math.max(0, Math.round(body.durationMs))
          : 0,
    });
    return NextResponse.json(scored);
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[interview/answer] 예상치 못한 오류:", err);
    return NextResponse.json(
      { error: "채점 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
