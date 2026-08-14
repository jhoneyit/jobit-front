import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { analyzeGap } from "@/lib/gap";
import { currentOwner } from "@/lib/owner";

export const runtime = "nodejs";

/**
 * POST /api/gap/analyze
 * body: { resumeId: string, jobPostingId: string }
 *
 * 갭 분석 화면은 클라이언트 컴포넌트라 브라우저에서 부른다. `owner_key` 는 **여기서만**
 * 계산한다 (`/api/interview/start` 와 같은 이유 — 클라이언트가 보내는 값을 믿으면 남의
 * 이력서로 분석을 걸 수 있다).
 *
 * **오래 걸린다.** 요구사항 수만큼 판정이 돌아 몇 분까지 간다 — `backendFetch` 의 타임아웃
 * (120초)이 여기에 걸릴 수 있는데, 백엔드는 계속 돌아 캐시에 저장되므로 사용자가 다시
 * 누르면 그때는 캐시 적중이다.
 */
export async function POST(req: Request) {
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "먼저 공고를 분석해 주세요." },
      { status: 400 },
    );
  }

  let body: { resumeId?: unknown; jobPostingId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  if (typeof body.resumeId !== "string" || typeof body.jobPostingId !== "string") {
    return NextResponse.json({ error: "이력서와 공고를 선택해 주세요." }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await analyzeGap(owner.key, body.resumeId, body.jobPostingId),
    );
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[gap/analyze] 예상치 못한 오류:", err);
    return NextResponse.json(
      { error: "갭 분석에 실패했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
