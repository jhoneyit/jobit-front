import { PROMPT_VERSION } from "@/lib/llm/prompts";
import { streamQuestions } from "@/lib/questions/generate";
import { consume, getOrCreateSessionId } from "@/lib/rate-limit";
import { getCachedQuestions } from "@/lib/store";
import type { QuestionStreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/questions?jobPostingId=...
 *
 * Server-Sent Events 로 질문을 하나씩 흘려보낸다 (스펙 §6 "SSE 스트리밍").
 * EventSource 가 GET 만 지원하므로 쿼리 파라미터를 쓴다.
 */
export async function GET(req: Request) {
  const jobPostingId = new URL(req.url).searchParams.get("jobPostingId");
  if (!jobPostingId) {
    return new Response("jobPostingId 가 필요합니다.", { status: 400 });
  }

  const sessionId = await getOrCreateSessionId();

  // 이미 생성된 세트가 있으면 LLM 을 부르지 않으므로 한도를 소비하지 않는다.
  if (!(await getCachedQuestions(jobPostingId, PROMPT_VERSION))) {
    const rate = consume(sessionId);
    if (!rate.allowed) {
      return new Response(
        `요청 한도를 초과했습니다. ${Math.ceil(rate.retryAfterSec / 60)}분 뒤에 다시 시도해주세요.`,
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: QuestionStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for await (const event of streamQuestions(jobPostingId)) {
          send(event);
        }
      } catch (err) {
        console.error("[api/questions] 스트림 실패:", err);
        send({ type: "error", message: "질문 생성 중 오류가 발생했습니다." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx 등 리버스 프록시가 SSE 를 버퍼링하지 않도록
      "X-Accel-Buffering": "no",
    },
  });
}
