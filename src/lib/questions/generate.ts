import { randomUUID } from "node:crypto";
import { toLlmError } from "@/lib/jd/parse";
import { anthropic, isRetryableUpstream, LlmError, logCall, modelChain } from "@/lib/llm/client";
import { MODEL_CONFIG } from "@/lib/llm/config";
import { IncrementalArrayParser } from "@/lib/llm/incremental-array";
import {
  PROMPT_VERSION,
  QUESTION_COUNT,
  QUESTION_GEN_SYSTEM,
  questionGenUserMessage,
} from "@/lib/llm/prompts";
import { QUESTIONS_JSON_SCHEMA, rawQuestionSchema } from "@/lib/llm/schema";
import {
  getCachedQuestions,
  getJobPosting,
  getRequirements,
  saveQuestionSet,
} from "@/lib/store";
import type { Question, QuestionStreamEvent, Requirement } from "@/lib/types";

/**
 * 스펙 §4.2 질문 생성.
 *
 *  - requirement 목록을 컨텍스트로 넣고 구조화 출력으로 질문 배열 수신
 *  - prompt_version 이 같으면 재생성하지 않는다
 *  - 완성된 질문부터 하나씩 흘려보낸다 (§6 SSE 스트리밍)
 */
export async function* streamQuestions(
  jobPostingId: string,
): AsyncGenerator<QuestionStreamEvent> {
  const posting = await getJobPosting(jobPostingId);
  const requirements = await getRequirements(jobPostingId);

  if (!posting || requirements.length === 0) {
    yield {
      type: "error",
      message: "공고를 찾을 수 없습니다. 공고를 다시 붙여넣어 주세요.",
    };
    return;
  }

  // prompt_version 이 같으면 재생성하지 않는다.
  const cached = await getCachedQuestions(jobPostingId, PROMPT_VERSION);
  if (cached) {
    yield { type: "meta", questionSetId: cached.set.id, total: cached.questions.length };
    for (const q of cached.questions) yield { type: "question", question: q };
    yield { type: "done", count: cached.questions.length };
    return;
  }

  // 세트 id 는 저장 시점에 DB 가 발급한다. 스트리밍 중에는 임시 id 로 화면 key 만 채운다.
  const draftId = randomUUID();
  yield { type: "meta", questionSetId: draftId, total: QUESTION_COUNT };

  const collected: Question[] = [];
  let usedModel = MODEL_CONFIG.QUESTION_GEN.model;

  try {
    for await (const q of callGenerate(posting.parsed, requirements, draftId)) {
      if (typeof q === "string") {
        usedModel = q; // 어떤 모델이 실제로 답했는지 (폴백됐을 수 있음)
        continue;
      }
      collected.push(q);
      yield { type: "question", question: q };
    }
  } catch (err) {
    const llmErr = toLlmError(err);
    // 일부라도 받았으면 버리지 않는다 — 사용자는 이미 화면에서 보고 있다.
    if (collected.length === 0) {
      yield { type: "error", message: llmErr.message };
      return;
    }
    console.error("[questions] 스트림 중단, 부분 결과 유지:", llmErr.message);
  }

  if (collected.length === 0) {
    yield { type: "error", message: "질문을 생성하지 못했습니다. 다시 시도해주세요." };
    return;
  }

  try {
    await saveQuestionSet(
      { jobPostingId, promptVersion: PROMPT_VERSION, model: usedModel },
      collected.map(({ requirementId, text, category, difficulty, followups, answerOutline }) => ({
        requirementId,
        text,
        category,
        difficulty,
        followups,
        answerOutline,
      })),
    );
  } catch (err) {
    // 저장 실패해도 사용자는 이미 질문을 다 봤다. 다음 방문 때 재생성될 뿐이다.
    console.error("[questions] 질문 세트 저장 실패:", err);
  }

  yield { type: "done", count: collected.length };
}

/**
 * 실제 스트리밍 호출. 완성된 질문을 하나씩 yield 하고,
 * 맨 처음에 한 번 "실제로 응답한 모델 이름"을 문자열로 yield 한다.
 */
async function* callGenerate(
  parsed: import("@/lib/types").ParsedJd,
  requirements: Requirement[],
  questionSetId: string,
): AsyncGenerator<Question | string> {
  const cfg = MODEL_CONFIG.QUESTION_GEN;
  const client = anthropic();
  let lastError: unknown;

  for (const model of modelChain("QUESTION_GEN")) {
    const startedAt = Date.now();
    const parser = new IncrementalArrayParser("questions");
    let emitted = 0;

    try {
      const stream = client.messages.stream({
        model,
        max_tokens: cfg.maxTokens,
        thinking: { type: "adaptive" },
        output_config: {
          effort: cfg.effort,
          format: { type: "json_schema", schema: QUESTIONS_JSON_SCHEMA },
        },
        system: [
          {
            type: "text",
            text: QUESTION_GEN_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          { role: "user", content: questionGenUserMessage(parsed, requirements) },
        ],
      });

      yield model;

      for await (const event of stream) {
        if (
          event.type !== "content_block_delta" ||
          event.delta.type !== "text_delta"
        ) {
          continue;
        }
        for (const raw of parser.push(event.delta.text)) {
          const question = toQuestion(raw, requirements, questionSetId, emitted);
          if (question) {
            emitted++;
            yield question;
          }
        }
      }

      const final = await stream.finalMessage();
      logCall({
        feature: "QUESTION_GEN",
        model,
        startedAt,
        usage: final.usage,
        cacheHit: false,
      });

      if (final.stop_reason === "refusal") {
        throw new LlmError(
          "이 공고로는 질문을 생성할 수 없습니다.",
          "REFUSAL",
        );
      }
      if (emitted === 0) {
        throw new Error(
          `질문을 하나도 파싱하지 못했습니다 (stop_reason=${final.stop_reason}).`,
        );
      }
      return;
    } catch (err) {
      lastError = err;
      if (err instanceof LlmError) throw err;
      // 이미 사용자에게 질문을 흘려보낸 뒤라면 다른 모델로 갈아타면 중복이 생긴다.
      if (emitted > 0) throw err;
      if (!isRetryableUpstream(err)) throw err;
      // 아무것도 못 보냈고 업스트림 장애 → 다음 모델로 폴백
    }
  }

  throw lastError ?? new Error("질문 생성 실패");
}

/** 모델이 뱉은 원소 하나를 검증하고 Question 으로 바꾼다. 어긋나면 그 질문만 버린다. */
function toQuestion(
  raw: unknown,
  requirements: Requirement[],
  questionSetId: string,
  index: number,
): Question | null {
  const parsed = rawQuestionSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[questions] 스키마 불일치로 질문 1개 폐기:", parsed.error.message);
    return null;
  }

  const { requirementIndex, ...rest } = parsed.data;
  const requirement =
    requirementIndex >= 0 && requirementIndex < requirements.length
      ? requirements[requirementIndex]
      : null;

  return {
    id: `${questionSetId}-${index}`,
    questionSetId,
    requirementId: requirement?.id ?? null,
    ...rest,
  };
}
