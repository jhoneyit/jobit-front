import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { llmCallLogs } from "@/lib/db/schema";
import type { LlmCallLog } from "@/lib/types";

/**
 * 스펙 §3.5 `llm_call_log`.
 *
 * "처음부터 넣는다. 나중에 넣으려면 귀찮고, 없으면 어느 기능이 돈을 먹는지 안 보인다."
 */

/**
 * 호출 1건을 기록한다.
 *
 * **의도적으로 await 하지 않는다.** 비용 로그를 남기려다 사용자 응답이 느려지거나,
 * 로그 INSERT 가 실패했다고 이미 성공한 LLM 응답을 버리는 건 앞뒤가 바뀐 것이다.
 * 실패하면 콘솔에만 남기고 요청은 그대로 진행한다.
 */
export function recordLlmCall(entry: Omit<LlmCallLog, "id" | "createdAt">): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[llm] ${entry.feature} ${entry.model} ` +
        `in=${entry.inputTokens} out=${entry.outputTokens} ` +
        `cache(r=${entry.cacheReadTokens},w=${entry.cacheCreationTokens}) ` +
        `$${entry.costUsd.toFixed(4)} ${entry.latencyMs}ms` +
        (entry.cacheHit ? " [HIT]" : ""),
    );
  }

  void db
    .insert(llmCallLogs)
    .values({
      feature: entry.feature,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      cacheReadTokens: entry.cacheReadTokens,
      cacheCreationTokens: entry.cacheCreationTokens,
      costUsd: entry.costUsd,
      cacheHit: entry.cacheHit,
      latencyMs: entry.latencyMs,
    })
    .catch((err) => console.error("[llm] 비용 로그 저장 실패:", err));
}

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
    costUsd: r.costUsd,
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
