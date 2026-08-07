import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { finishInterview } from "@/lib/interviews";
import { currentOwner } from "@/lib/owner";

export const runtime = "nodejs";

/**
 * POST /api/interview/{sessionId}/finish
 *
 * 멱등이다 — 이미 닫힌 세션에 다시 불러도 같은 결과를 준다. 마지막 문항 제출과 종료가 겹치거나
 * 사용자가 새로고침하는 것은 정상 경로라 오류로 만들지 않는다.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ error: "세션이 만료되었습니다." }, { status: 400 });
  }

  const { sessionId } = await params;

  try {
    return NextResponse.json(await finishInterview(owner.key, sessionId));
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[interview/finish] 예상치 못한 오류:", err);
    return NextResponse.json(
      { error: "면접 연습을 마치지 못했습니다." },
      { status: 500 },
    );
  }
}
