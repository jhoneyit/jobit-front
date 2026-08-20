import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { getVideoSummary } from "@/lib/videos";

export const runtime = "nodejs";

/** GET /api/videos/status?id=... — 폴링. 공유 링크와 같은 무소유 조회라 owner 를 읽지 않는다. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 });
  }
  try {
    return NextResponse.json(await getVideoSummary(id));
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[videos/status] 예상치 못한 오류:", err);
    return NextResponse.json({ error: "상태를 확인하지 못했습니다." }, { status: 500 });
  }
}
