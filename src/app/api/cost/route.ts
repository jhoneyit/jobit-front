import { NextResponse } from "next/server";
import { listLlmCalls, summarizeCost } from "@/lib/llm/cost";

export const runtime = "nodejs";

/**
 * GET /api/cost
 *
 * 스펙 §6 "llm_call_log 기반 비용 대시보드" 의 최소 형태.
 * 어느 기능이 돈을 먹는지 개발 중에 바로 확인하기 위한 것 — 운영에서는 막는다.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const [summary, recent] = await Promise.all([summarizeCost(), listLlmCalls(50)]);
  return NextResponse.json({ summary, recent });
}
