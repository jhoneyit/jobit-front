import { NextResponse } from "next/server";
import { BackendError } from "@/lib/backend";
import { fetchVideoFrame } from "@/lib/videos";

export const runtime = "nodejs";

/**
 * GET /api/videos/frame?id=..&t=.. — 섹션 캡처 프록시.
 *
 * 브라우저 <img> 는 백엔드 서명 헤더를 붙일 수 없으므로 이 라우트가 대신 서명해 바이트를
 * 흘려보낸다. 캐시 헤더를 그대로 넘겨 재방문이 백엔드까지 오지 않게 한다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const t = Number(url.searchParams.get("t"));
  if (!id || !Number.isInteger(t) || t < 0) {
    return NextResponse.json({ error: "요청 값이 올바르지 않습니다." }, { status: 400 });
  }
  try {
    const upstream = await fetchVideoFrame(id, t);
    return new NextResponse(upstream.body, {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": upstream.headers.get("cache-control") ?? "max-age=604800",
      },
    });
  } catch (err) {
    if (err instanceof BackendError && err.status === 404) {
      return new NextResponse(null, { status: 404 });
    }
    console.error("[videos/frame] 오류:", err);
    return new NextResponse(null, { status: 502 });
  }
}
