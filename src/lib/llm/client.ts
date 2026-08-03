import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_PRICING, MODEL_CONFIG, PRICING } from "@/lib/llm/config";
import { recordLlmCall } from "@/lib/llm/cost";
import type { LlmFeature } from "@/lib/types";

let cached: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new LlmError(
      "ANTHROPIC_API_KEY 가 설정되지 않았습니다. .env.example 을 .env.local 로 복사하고 키를 넣어주세요.",
      "CONFIG",
    );
  }
  cached ??= new Anthropic({
    // 스트리밍 응답이 길어질 수 있어 넉넉히. SDK 기본 재시도(429/5xx)는 그대로 둔다.
    timeout: 120_000,
    maxRetries: 2,
  });
  return cached;
}

export type LlmErrorKind = "CONFIG" | "SCHEMA" | "REFUSAL" | "UPSTREAM" | "RATE_LIMIT";

export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: LlmErrorKind,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

/**
 * 모델 장애 시 폴백 (§6 엔지니어링 체크리스트).
 * 앞 모델이 과부하/서버에러면 다음 모델로 넘어간다. 4xx(요청 자체가 잘못)는 폴백하지 않는다.
 */
export const FALLBACK_MODELS = ["claude-opus-5", "claude-sonnet-5"] as const;

export function modelChain(feature: LlmFeature): string[] {
  const primary = MODEL_CONFIG[feature].model;
  return [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
}

export function isRetryableUpstream(err: unknown): boolean {
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.APIError) {
    return err.status === undefined || err.status >= 500 || err.status === 429;
  }
  return false;
}

/** usage 를 달러로 환산. 캐시 read는 0.1x, 캐시 write는 1.25x 로 계산한다. */
export function estimateCostUsd(
  model: string,
  usage: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  },
): number {
  const p = PRICING[model] ?? DEFAULT_PRICING;
  const inTok = usage.input_tokens ?? 0;
  const outTok = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;

  return (
    (inTok * p.input +
      cacheRead * p.input * 0.1 +
      cacheWrite * p.input * 1.25 +
      outTok * p.output) /
    1_000_000
  );
}

/** 호출 하나를 llm_call_log 에 남긴다 (§3.5). */
export function logCall(args: {
  feature: LlmFeature;
  model: string;
  startedAt: number;
  usage: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  } | null;
  cacheHit: boolean;
}): void {
  const u = args.usage ?? {};
  recordLlmCall({
    feature: args.feature,
    model: args.model,
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
    costUsd: estimateCostUsd(args.model, u),
    cacheHit: args.cacheHit,
    latencyMs: Date.now() - args.startedAt,
  });
}
