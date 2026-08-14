import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { rewriteGapItem } from "@/lib/gap";
import { currentOwner } from "@/lib/owner";

export const runtime = "nodejs";

/**
 * POST /api/gap/rewrite
 * body: { gapItemId: string }
 *
 * WEAK 항목의 수정안을 만들거나(수십 초 — thinking) 이미 있으면 즉시 돌려준다.
 * 남의 항목 id 를 넣어도 백엔드가 owner_key 를 조회 조건에 넣어 404 를 준다.
 */
export async function POST(req: Request) {
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "먼저 공고를 분석해 주세요." },
      { status: 400 },
    );
  }

  let body: { gapItemId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  if (typeof body.gapItemId !== "string") {
    return NextResponse.json({ error: "수정안을 만들 항목을 선택해 주세요." }, { status: 400 });
  }

  try {
    return NextResponse.json(await rewriteGapItem(owner.key, body.gapItemId));
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[gap/rewrite] 예상치 못한 오류:", err);
    return NextResponse.json(
      { error: "수정안을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
