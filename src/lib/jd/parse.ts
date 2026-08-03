import Anthropic from "@anthropic-ai/sdk";
import {
  anthropic,
  isRetryableUpstream,
  LlmError,
  logCall,
  modelChain,
} from "@/lib/llm/client";
import { MODEL_CONFIG } from "@/lib/llm/config";
import { JD_PARSE_SYSTEM, jdParseUserMessage } from "@/lib/llm/prompts";
import { JD_PARSE_JSON_SCHEMA, jdParseResultSchema } from "@/lib/llm/schema";
import type { JdParseResult } from "@/lib/llm/schema";
import {
  findJobPostingByHash,
  getRequirements,
  recordSubmission,
  saveJobPosting,
} from "@/lib/store";
import type { ParseJdResponse } from "@/lib/types";

const SCHEMA_RETRIES = 2;

/**
 * 스펙 §4.1 JD 파싱 전체 흐름.
 *  1. 본문 정규화 → 해시  (호출부에서 이미 끝냄)
 *  2. content_hash 로 조회 → 있으면 그대로 재사용
 *  3. 없으면 LLM 호출 → job_posting + requirement 저장
 */
export async function parseJd(args: {
  normalized: string;
  hash: string;
  sourceUrl?: string | null;
  /** 제출 이력을 남길 소유자. 없으면 기록하지 않는다. */
  ownerKey?: string | null;
}): Promise<ParseJdResponse> {
  // 2단계 — 캐시 조회. 인기 공고는 여러 사용자가 붙여넣기 때문에 적중률이 높다.
  const cached = await findJobPostingByHash(args.hash);
  if (cached) {
    // 캐시 적중이어도 "이 사람이 이 공고를 봤다"는 사실은 새로 남긴다.
    if (args.ownerKey) await recordSubmission(args.ownerKey, cached.id);
    return {
      jobPostingId: cached.id,
      parsed: cached.parsed,
      requirements: await getRequirements(cached.id),
      cacheHit: true,
    };
  }

  // 3단계 — LLM 호출
  const result = await callParse(args.normalized);

  const { posting, requirements } = await saveJobPosting(
    {
      contentHash: args.hash,
      rawText: args.normalized,
      sourceUrl: args.sourceUrl ?? null,
      company: result.parsed.company,
      title: result.parsed.title,
      parsed: result.parsed,
    },
    result.requirements.map((r, i) => ({
      text: r.text,
      kind: r.kind,
      keywords: r.keywords,
      sortOrder: i,
    })),
  );

  if (args.ownerKey) await recordSubmission(args.ownerKey, posting.id);

  return {
    jobPostingId: posting.id,
    parsed: posting.parsed,
    requirements,
    cacheHit: false,
  };
}

/**
 * 구조화 출력 호출 + 서버 재검증 + 실패 시 재시도 (§6 체크리스트).
 * 모델이 죽으면 다음 모델로 폴백한다.
 */
async function callParse(normalizedJd: string): Promise<JdParseResult> {
  const cfg = MODEL_CONFIG.JD_PARSE;
  const client = anthropic();
  let lastError: unknown;

  for (const model of modelChain("JD_PARSE")) {
    for (let attempt = 0; attempt <= SCHEMA_RETRIES; attempt++) {
      const startedAt = Date.now();
      try {
        const response = await client.messages.create({
          model,
          max_tokens: cfg.maxTokens,
          // 스택·연차 추출은 깊은 추론이 필요 없다. effort 로 비용을 잡는다.
          thinking: { type: "adaptive" },
          output_config: {
            effort: cfg.effort,
            format: { type: "json_schema", schema: JD_PARSE_JSON_SCHEMA },
          },
          system: [
            {
              type: "text",
              text: JD_PARSE_SYSTEM,
              // 시스템 프롬프트는 요청마다 동일하므로 캐시한다.
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            {
              role: "user",
              content:
                attempt === 0
                  ? jdParseUserMessage(normalizedJd)
                  : `${jdParseUserMessage(normalizedJd)}\n\n(이전 응답이 스키마를 벗어났습니다. 스키마를 정확히 지켜 다시 출력해주세요.)`,
            },
          ],
        });

        logCall({
          feature: "JD_PARSE",
          model,
          startedAt,
          usage: response.usage,
          cacheHit: false,
        });

        if (response.stop_reason === "refusal") {
          throw new LlmError(
            "이 공고는 안전 정책상 처리할 수 없습니다. 다른 공고로 시도해주세요.",
            "REFUSAL",
          );
        }
        if (response.stop_reason === "max_tokens") {
          throw new SchemaError("응답이 max_tokens 에서 잘렸습니다.");
        }

        return jdParseResultSchema.parse(JSON.parse(extractText(response)));
      } catch (err) {
        lastError = err;

        // 요청 자체가 거절된 경우는 재시도해도 같다.
        if (err instanceof LlmError) throw err;

        // 스키마/파싱 실패 → 같은 모델로 재시도
        if (err instanceof SchemaError || err instanceof SyntaxError || isZodError(err)) {
          if (attempt < SCHEMA_RETRIES) continue;
          break; // 재시도 소진 → 다음 모델로
        }

        // 업스트림 장애 → 다음 모델로 폴백
        if (isRetryableUpstream(err)) break;

        // 4xx 등 우리 잘못 → 폴백 의미 없음
        throw toLlmError(err);
      }
    }
  }

  throw toLlmError(lastError);
}

class SchemaError extends Error {}

function isZodError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "ZodError"
  );
}

export function extractText(response: Anthropic.Message): string {
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text.trim()) throw new SchemaError("모델이 빈 응답을 반환했습니다.");
  return text;
}

export function toLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  if (err instanceof Anthropic.RateLimitError) {
    return new LlmError(
      "요청이 몰려 잠시 처리할 수 없습니다. 잠깐 뒤 다시 시도해주세요.",
      "RATE_LIMIT",
      err,
    );
  }
  if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIConnectionError) {
    return new LlmError(
      "모델 호출에 실패했습니다. 잠시 뒤 다시 시도해주세요.",
      "UPSTREAM",
      err,
    );
  }
  return new LlmError(
    "공고를 분석하지 못했습니다. 본문을 확인하고 다시 시도해주세요.",
    "SCHEMA",
    err,
  );
}
