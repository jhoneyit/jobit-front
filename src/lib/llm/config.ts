import type { LlmFeature } from "@/lib/types";

/**
 * 기능별 모델·effort 설정.
 *
 * 스펙 §2는 "파싱은 저렴한 모델 / 리라이트는 상위 모델"로 티어를 나누라고 한다.
 * 다만 텍스트 품질이 곧 제품 가치인 유형(§6)이라, 기본값은 전부 최상위 모델로 두고
 * **비용 조절은 effort로 먼저** 한다 — 파싱은 low, 질문 생성은 high.
 *
 * 실제 비용이 유의미해지면 여기 `model`만 바꿔서 티어를 내리면 된다.
 * (llm_call_log 대시보드로 어느 기능이 돈을 먹는지 확인한 뒤 결정 — §3.5)
 */

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface FeatureConfig {
  model: string;
  effort: Effort;
  maxTokens: number;
}

export const MODEL_CONFIG: Record<LlmFeature, FeatureConfig> = {
  // JD 파싱: 구조화 추출이라 깊은 추론이 필요 없다. effort로 비용을 낮춘다.
  JD_PARSE: { model: "claude-opus-5", effort: "low", maxTokens: 8_000 },
  // 질문 생성: 제품의 첫인상을 결정하는 지점. 품질에 투자한다.
  QUESTION_GEN: { model: "claude-opus-5", effort: "high", maxTokens: 16_000 },
  // 3단계 — 요구사항 1개 + 후보 문장 3개로 판정만. 입력이 짧다.
  GAP_ANALYSIS: { model: "claude-opus-5", effort: "medium", maxTokens: 4_000 },
  // 4단계 — 문장 하나를 고쳐 쓴다. 문장 품질이 곧 제품 가치.
  REWRITE: { model: "claude-opus-5", effort: "high", maxTokens: 4_000 },
};

/** USD per 1M tokens. 비용 로그 계산용 — 모델을 바꾸면 여기도 같이 바꾼다. */
export const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

export const DEFAULT_PRICING = { input: 5.0, output: 25.0 };
