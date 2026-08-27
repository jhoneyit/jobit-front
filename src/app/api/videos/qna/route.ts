import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { anonOwnerKey } from "@/lib/owner";
import { currentOwner } from "@/lib/owner";
import { getOrCreateSessionId } from "@/lib/rate-limit";
import { askVideoQnaStream } from "@/lib/videos";

export const runtime = "nodejs";
export const maxDuration = 600;

/**
 * POST /api/videos/qna — 공유 링크 방문자도 질문할 수 있게 익명 쿠키를 발급한다 (submit 과 같은 결정).
 *
 * **응답은 SSE 를 그대로 관통시킨다** (2026-08-27). 질문 SSE 라우트와 달리 번역이 없다 —
 * 화면(QnaPanel)이 백엔드 프레임(`event: delta|done|error`)을 직접 읽는다. 스트림을 열기
 * 전의 실패(검증·한도·연결)는 이전과 같은 JSON 오류라, 화면은 content-type 으로 가른다.
 */
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
    const upstream = await askVideoQnaStream(
      ownerKey, body.summaryId, body.question.trim(), history,
    );
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
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
