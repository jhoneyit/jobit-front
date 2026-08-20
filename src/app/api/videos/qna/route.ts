import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { anonOwnerKey } from "@/lib/owner";
import { currentOwner } from "@/lib/owner";
import { getOrCreateSessionId } from "@/lib/rate-limit";
import { askVideoQna } from "@/lib/videos";

export const runtime = "nodejs";

/** POST /api/videos/qna — 공유 링크 방문자도 질문할 수 있게 익명 쿠키를 발급한다 (submit 과 같은 결정). */
export async function POST(req: Request) {
  let body: { summaryId?: unknown; question?: unknown; history?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  if (typeof body.summaryId !== "string" || typeof body.question !== "string"
      || !body.question.trim()) {
    return NextResponse.json({ error: "질문을 입력해 주세요." }, { status: 400 });
  }
  const history = Array.isArray(body.history)
    ? body.history.filter((h): h is string => typeof h === "string").slice(-6)
    : [];

  const owner = await currentOwner();
  const ownerKey = owner?.key ?? anonOwnerKey(await getOrCreateSessionId());

  try {
    return NextResponse.json(
      await askVideoQna(ownerKey, body.summaryId, body.question.trim(), history),
    );
  } catch (err) {
    if (err instanceof BackendError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[videos/qna] 예상치 못한 오류:", err);
    return NextResponse.json(
      { error: "답변을 받지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
