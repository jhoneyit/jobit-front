import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { startInterview } from "@/lib/interviews";
import { currentOwner } from "@/lib/owner";

export const runtime = "nodejs";

/**
 * POST /api/interview/start
 * body: { jobPostingId: string }
 *
 * 연습 화면은 클라이언트 컴포넌트라 브라우저에서 직접 부른다. `owner_key` 는 **여기서만**
 * 계산한다 — 세션·쿠키를 읽는 것은 이 레포만 할 수 있고, 클라이언트가 보내는 값을 그대로
 * 믿으면 남의 기록에 세션을 심을 수 있다 (`/api/jd/parse` 와 같은 이유).
 */
export async function POST(req: Request) {
  const owner = await currentOwner();
  if (!owner) {
    // 공고를 한 번이라도 분석했으면 익명 쿠키가 있다. 없다는 것은 아직 아무것도 안 한 방문자다.
    return NextResponse.json(
      { error: "먼저 공고를 분석해 주세요." },
      { status: 400 },
    );
  }

  let body: { jobPostingId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  if (typeof body.jobPostingId !== "string") {
    return NextResponse.json({ error: "공고를 선택해 주세요." }, { status: 400 });
  }

  try {
    return NextResponse.json(await startInterview(owner.key, body.jobPostingId));
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[interview/start] 예상치 못한 오류:", err);
    return NextResponse.json(
      { error: "면접 연습을 시작하지 못했습니다." },
      { status: 500 },
    );
  }
}
