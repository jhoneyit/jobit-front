import { auth } from "@/auth";
import { BackendError, backendFetch } from "@/lib/backend";
import { anonOwnerKey, userOwnerKey } from "@/lib/owner";
import { getOrCreateSessionId } from "@/lib/rate-limit";
import type { Question, QuestionStreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/questions?jobPostingId=...
 *
 * **2026-08-04 이관: 생성은 `jobit` 백엔드가 한다.** 이 라우트는 백엔드의 SSE 를 받아
 * 화면이 쓰는 이벤트 형태로 옮겨 다시 흘려보낸다.
 *
 * 형식을 번역하는 이유: 백엔드는 SSE 표준대로 `event: question` 처럼 **이벤트 이름**을 쓰고,
 * 이 레포의 클라이언트는 `data:` 안의 `{ type }` 필드로 분기한다. 클라이언트를 고치는 대신
 * 여기서 맞춰 준다 — 화면 코드는 손대지 않는다.
 */
export async function GET(req: Request) {
  const jobPostingId = new URL(req.url).searchParams.get("jobPostingId");
  if (!jobPostingId) {
    return new Response("jobPostingId 가 필요합니다.", { status: 400 });
  }

  // 레이트 리밋은 백엔드가 건다 (jobit LlmGuard). 여기서 미리 세면 두 곳이 각자 세어
  // 실질 한도가 어긋나고, 무엇보다 캐시 적중까지 소비하게 된다 — 백엔드는 캐시를 지나온
  // 뒤에만 소비하므로 그쪽이 정확하다. 이쪽이 할 일은 owner_key 를 정해 넘기는 것뿐이다.
  const sessionId = await getOrCreateSessionId();
  const session = await auth();
  const ownerKey = session?.user?.id
    ? userOwnerKey(session.user.id)
    : anonOwnerKey(sessionId);

  try {
    const upstream = await backendFetch(
      `/api/questions?jobPostingId=${encodeURIComponent(jobPostingId)}`,
      { ownerKey, headers: { accept: "text/event-stream" } },
    );
    return sse(translate(upstream));
  } catch (err) {
    const message =
      err instanceof BackendError ? err.message : "질문 생성 중 오류가 발생했습니다.";
    // 스트림을 열기도 전에 실패했다. 클라이언트가 이해하는 형태로 한 건만 보내고 닫는다.
    return sse(errorOnly(message));
  }
}

function sse(body: ReadableStream<Uint8Array>): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx 등 리버스 프록시가 SSE 를 버퍼링하지 않도록
      "X-Accel-Buffering": "no",
    },
  });
}

function encode(event: QuestionStreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

function errorOnly(message: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encode({ type: "error", message }));
      controller.close();
    },
  });
}

/**
 * 백엔드 SSE(`event: NAME` + `data: {...}`) → 화면 이벤트(`data: {type:...}`).
 *
 * SSE 프레임은 빈 줄로 구분되고, 네트워크 조각은 그 경계를 무시하고 잘려 온다. 그래서 버퍼에
 * 모아 두고 `\n\n` 이 나올 때만 한 프레임씩 꺼낸다 — 이걸 빠뜨리면 프레임이 반쪽으로 잘려
 * JSON 파싱이 터진다.
 */
function translate(upstream: Response): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) {
        controller.enqueue(encode({ type: "error", message: "질문 생성 응답이 비어 있습니다." }));
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let emitted = 0;

      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let sep = buffer.indexOf("\n\n");
          while (sep >= 0) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);

            const event = toClientEvent(frame, emitted);
            if (event) {
              if (event.type === "question") emitted++;
              controller.enqueue(encode(event));
            }
            sep = buffer.indexOf("\n\n");
          }
        }
      } catch (err) {
        console.error("[api/questions] 백엔드 스트림 중단:", err);
        // 일부라도 흘려보냈으면 사용자는 이미 보고 있다. done 으로 닫아 화면을 정리한다.
        controller.enqueue(
          encode(
            emitted > 0
              ? { type: "done", count: emitted }
              : { type: "error", message: "질문 생성이 중단됐습니다. 다시 시도해 주세요." },
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
}

/** SSE 프레임 한 개를 화면 이벤트로. 알 수 없는 이벤트와 하트비트는 무시한다. */
function toClientEvent(frame: string, emitted: number): QuestionStreamEvent | null {
  let name = "message";
  const dataLines: string[] = [];

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    // ":" 로 시작하는 주석(하트비트)과 빈 줄은 버린다.
  }
  if (dataLines.length === 0) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    console.warn("[api/questions] SSE 프레임 파싱 실패, 건너뜀:", frame.slice(0, 120));
    return null;
  }

  switch (name) {
    case "question": {
      const q = data.question as Question & { sortOrder?: number };
      return {
        type: "question",
        // 백엔드는 저장 전이라 id 를 주지 않는다. 화면 key 용으로 순서를 쓴다.
        question: { ...q, id: `q-${q.sortOrder ?? emitted}`, questionSetId: "" },
      };
    }
    case "done":
      return { type: "done", count: Number(data.count ?? emitted) };
    case "error":
      return { type: "error", message: String(data.message ?? "질문 생성에 실패했습니다.") };
    default:
      return null;
  }
}
