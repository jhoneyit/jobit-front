import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { currentOwner } from "@/lib/owner";
import { submitVideo } from "@/lib/videos";
import { anonOwnerKey } from "@/lib/owner";
import { getOrCreateSessionId } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/videos/submit — 요약 접수. `owner_key` 는 서버에서만 계산한다
 * (`/api/interview/start` 와 같은 이유).
 *
 * **익명 쿠키가 없으면 발급한다.** 영상 요약은 공고 분석 없이 처음 오는 진입점이 될 수
 * 있어, "먼저 공고를 분석해 주세요"로 돌려보내면 기능이 성립하지 않는다.
 */
export async function POST(req: Request) {
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  if (typeof body.url !== "string" || !body.url.trim()) {
    return NextResponse.json({ error: "유튜브 영상 주소를 넣어 주세요." }, { status: 400 });
  }

  const owner = await currentOwner();
  const ownerKey = owner?.key ?? anonOwnerKey(await getOrCreateSessionId());

  try {
    return NextResponse.json(await submitVideo(ownerKey, body.url.trim()));
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[videos/submit] 예상치 못한 오류:", err);
    return NextResponse.json(
      { error: "요약을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
