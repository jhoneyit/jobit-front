import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { llmCallLogs } from "@/lib/db/schema";
import type { LlmCallLog } from "@/lib/types";

/**
 * 스펙 §3.5 `llm_call_log` — **조회 전용**.
 *
 * 2026-08-04 이관 후 기록 주체는 `jobit`(Spring)이다. LLM 호출이 저쪽으로 넘어갔으므로
 * 이 레포는 같은 테이블을 읽기만 한다. 여기에 쓰기 함수를 되살리면 두 곳이 같은 테이블에
 * 기록하게 되어 비용 집계가 어긋난다.
 */

export async function listLlmCalls(limit = 50): Promise<LlmCallLog[]> {
  const rows = await db
    .select()
    .from(llmCallLogs)
    .orderBy(desc(llmCallLogs.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    feature: r.feature,
    model: r.model,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    cacheReadTokens: r.cacheReadTokens,
    cacheCreationTokens: r.cacheCreationTokens,
    costUsd: Number(r.costUsd),
    cacheHit: r.cacheHit,
    latencyMs: r.latencyMs,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface CostSummary {
  totalCalls: number;
  totalCostUsd: number;
  cacheHits: number;
  byFeature: Record<
    string,
    { calls: number; costUsd: number; inputTokens: number; outputTokens: number }
  >;
}

/** §6 "llm_call_log 기반 비용 대시보드" 의 최소 형태. */
export async function summarizeCost(): Promise<CostSummary> {
  const rows = await db
    .select({
      feature: llmCallLogs.feature,
      calls: sql<number>`count(*)`.mapWith(Number),
      costUsd: sql<number>`coalesce(sum(${llmCallLogs.costUsd}), 0)`.mapWith(Number),
      inputTokens: sql<number>`coalesce(sum(${llmCallLogs.inputTokens}), 0)`.mapWith(Number),
      outputTokens: sql<number>`coalesce(sum(${llmCallLogs.outputTokens}), 0)`.mapWith(Number),
      cacheHits: sql<number>`count(*) filter (where ${llmCallLogs.cacheHit})`.mapWith(Number),
    })
    .from(llmCallLogs)
    .groupBy(llmCallLogs.feature);

  const byFeature: CostSummary["byFeature"] = {};
  let totalCalls = 0;
  let totalCostUsd = 0;
  let cacheHits = 0;

  for (const r of rows) {
    byFeature[r.feature] = {
      calls: r.calls,
      costUsd: r.costUsd,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
    };
    totalCalls += r.calls;
    totalCostUsd += r.costUsd;
    cacheHits += r.cacheHits;
  }

  return { totalCalls, totalCostUsd, cacheHits, byFeature };
}
