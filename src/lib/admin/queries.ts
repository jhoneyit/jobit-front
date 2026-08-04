import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  jdSubmissions,
  jobPostings,
  llmCallLogs,
  questionSets,
  questions,
  requirements,
  users,
} from "@/lib/db/schema";
import type { ParsedJd, QuestionCategory, RequirementKind } from "@/lib/types";

/**
 * 관리자 콘솔용 조회.
 *
 * **사용자 화면의 조회와 섞지 않는다.** `lib/store.ts` 쪽은 전부 `owner_key` 로 범위를 좁히는
 * 게 전제인데, 여기는 반대로 전수 조회다. 같은 파일에 두면 언젠가 관리자용 쿼리가 사용자
 * 경로로 새어 나간다.
 *
 * `owner_key` 규약은 `user:<user_id>` 또는 `anon:<uuid>` 다 (스키마 주석 참고). 사람 이름을
 * 붙이려면 앞의 `user:` 를 떼고 `user` 테이블과 이어야 한다 — 아래 {@link userIdFromOwnerKey}.
 */

/** `user:abc` → `abc`, `anon:...` → null. 조인 조건으로 쓴다. */
const userIdFromOwnerKey = sql<string | null>`
  case when ${jdSubmissions.ownerKey} like 'user:%'
       then substring(${jdSubmissions.ownerKey} from 6)
  end`;

// ─── 대시보드 ─────────────────────────────────────────────────────────────

export interface AdminOverview {
  users: number;
  postings: number;
  submissions: number;
  anonSubmissions: number;
  questionSets: number;
  totalCalls: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheHits: number;
  byFeature: {
    feature: string;
    calls: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  }[];
}

export async function getOverview(): Promise<AdminOverview> {
  const one = <T extends Record<string, unknown>>(rows: T[]): T => rows[0];

  const [userRow, postingRow, submissionRow, questionSetRow, featureRows] =
    await Promise.all([
      db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(users).then(one),
      db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(jobPostings).then(one),
      db
        .select({
          n: sql<number>`count(*)`.mapWith(Number),
          anon: sql<number>`count(*) filter (where ${jdSubmissions.ownerKey} like 'anon:%')`.mapWith(
            Number,
          ),
        })
        .from(jdSubmissions)
        .then(one),
      db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(questionSets).then(one),
      db
        .select({
          feature: llmCallLogs.feature,
          calls: sql<number>`count(*)`.mapWith(Number),
          costUsd: sql<number>`coalesce(sum(${llmCallLogs.costUsd}), 0)`.mapWith(Number),
          inputTokens: sql<number>`coalesce(sum(${llmCallLogs.inputTokens}), 0)`.mapWith(Number),
          outputTokens: sql<number>`coalesce(sum(${llmCallLogs.outputTokens}), 0)`.mapWith(Number),
          cacheHits: sql<number>`count(*) filter (where ${llmCallLogs.cacheHit})`.mapWith(Number),
        })
        .from(llmCallLogs)
        .groupBy(llmCallLogs.feature),
    ]);

  return {
    users: userRow.n,
    postings: postingRow.n,
    submissions: submissionRow.n,
    anonSubmissions: submissionRow.anon,
    questionSets: questionSetRow.n,
    totalCalls: featureRows.reduce((s, r) => s + r.calls, 0),
    totalCostUsd: featureRows.reduce((s, r) => s + r.costUsd, 0),
    totalInputTokens: featureRows.reduce((s, r) => s + r.inputTokens, 0),
    totalOutputTokens: featureRows.reduce((s, r) => s + r.outputTokens, 0),
    cacheHits: featureRows.reduce((s, r) => s + r.cacheHits, 0),
    byFeature: featureRows
      .map((r) => ({
        feature: r.feature,
        calls: r.calls,
        costUsd: r.costUsd,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
  };
}

// ─── 제출 이력: 누가 어떤 공고를 넣었나 ───────────────────────────────────

export interface AdminSubmission {
  id: string;
  jobPostingId: string;
  ownerKey: string;
  /** 로그인 사용자면 이름/이메일, 익명이면 null */
  userName: string | null;
  userEmail: string | null;
  company: string | null;
  title: string | null;
  createdAt: string;
  requirementCount: number;
  /** 질문이 생성됐는지 = "답변이 나왔는지" */
  questionCount: number;
}

export async function listSubmissions(limit = 200): Promise<AdminSubmission[]> {
  const rows = await db
    .select({
      id: jdSubmissions.id,
      jobPostingId: jdSubmissions.jobPostingId,
      ownerKey: jdSubmissions.ownerKey,
      userName: users.name,
      userEmail: users.email,
      company: jobPostings.company,
      title: jobPostings.title,
      createdAt: jdSubmissions.createdAt,
      // 상관 서브쿼리로 센다. join + group by 로 하면 요구사항 × 질문 카티션 곱이 나서
      // 두 개수가 서로를 부풀린다.
      requirementCount: sql<number>`(
        select count(*) from ${requirements}
        where ${requirements.jobPostingId} = ${jdSubmissions.jobPostingId})`.mapWith(Number),
      questionCount: sql<number>`(
        select count(*) from ${questions}
        join ${questionSets} on ${questions.questionSetId} = ${questionSets.id}
        where ${questionSets.jobPostingId} = ${jdSubmissions.jobPostingId})`.mapWith(Number),
    })
    .from(jdSubmissions)
    .innerJoin(jobPostings, eq(jobPostings.id, jdSubmissions.jobPostingId))
    .leftJoin(users, eq(users.id, userIdFromOwnerKey))
    .orderBy(desc(jdSubmissions.createdAt))
    .limit(limit);

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

// ─── 공고 상세: 요구사항 + 생성된 질문 ────────────────────────────────────

export interface AdminPostingDetail {
  id: string;
  company: string | null;
  title: string | null;
  rawText: string;
  parsed: ParsedJd;
  createdAt: string;
  submitters: { ownerKey: string; userName: string | null; userEmail: string | null; at: string }[];
  requirements: { id: string; text: string; kind: RequirementKind; keywords: string[] }[];
  questionSets: {
    id: string;
    model: string;
    promptVersion: string;
    createdAt: string;
    questions: {
      id: string;
      text: string;
      category: QuestionCategory;
      difficulty: number;
      followups: string[];
      answerOutline: string[];
    }[];
  }[];
}

export async function getPostingDetail(id: string): Promise<AdminPostingDetail | null> {
  const posting = await db.query.jobPostings.findFirst({ where: eq(jobPostings.id, id) });
  if (!posting) return null;

  const [reqRows, setRows, submitterRows] = await Promise.all([
    db
      .select({
        id: requirements.id,
        text: requirements.text,
        kind: requirements.kind,
        keywords: requirements.keywords,
      })
      .from(requirements)
      .where(eq(requirements.jobPostingId, id))
      .orderBy(requirements.sortOrder),
    db
      .select({
        id: questionSets.id,
        model: questionSets.model,
        promptVersion: questionSets.promptVersion,
        createdAt: questionSets.createdAt,
      })
      .from(questionSets)
      .where(eq(questionSets.jobPostingId, id))
      .orderBy(desc(questionSets.createdAt)),
    db
      .select({
        ownerKey: jdSubmissions.ownerKey,
        userName: users.name,
        userEmail: users.email,
        at: jdSubmissions.createdAt,
      })
      .from(jdSubmissions)
      .leftJoin(users, eq(users.id, userIdFromOwnerKey))
      .where(eq(jdSubmissions.jobPostingId, id))
      .orderBy(desc(jdSubmissions.createdAt)),
  ]);

  const questionRows = setRows.length
    ? await db
        .select({
          id: questions.id,
          questionSetId: questions.questionSetId,
          text: questions.text,
          category: questions.category,
          difficulty: questions.difficulty,
          followups: questions.followups,
          answerOutline: questions.answerOutline,
        })
        .from(questions)
        .innerJoin(questionSets, eq(questions.questionSetId, questionSets.id))
        .where(eq(questionSets.jobPostingId, id))
        .orderBy(questions.sortOrder)
    : [];

  return {
    id: posting.id,
    company: posting.company,
    title: posting.title,
    rawText: posting.rawText,
    parsed: posting.parsed,
    createdAt: posting.createdAt.toISOString(),
    submitters: submitterRows.map((s) => ({ ...s, at: s.at.toISOString() })),
    requirements: reqRows,
    questionSets: setRows.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      questions: questionRows
        .filter((q) => q.questionSetId === s.id)
        .map((q) => ({
          id: q.id,
          text: q.text,
          category: q.category,
          difficulty: q.difficulty,
          followups: q.followups,
          answerOutline: q.answerOutline,
        })),
    })),
  };
}

// ─── 토큰 사용량 ──────────────────────────────────────────────────────────

export interface AdminUsage {
  byModel: {
    model: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }[];
  byDay: { day: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number }[];
  recent: {
    id: string;
    feature: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    costUsd: number;
    cacheHit: boolean;
    latencyMs: number;
    createdAt: string;
  }[];
}

export async function getUsage(days = 30, recentLimit = 100): Promise<AdminUsage> {
  const since = sql`now() - ${`${days} days`}::interval`;

  const [byModel, byDay, recent] = await Promise.all([
    db
      .select({
        model: llmCallLogs.model,
        calls: sql<number>`count(*)`.mapWith(Number),
        inputTokens: sql<number>`coalesce(sum(${llmCallLogs.inputTokens}), 0)`.mapWith(Number),
        outputTokens: sql<number>`coalesce(sum(${llmCallLogs.outputTokens}), 0)`.mapWith(Number),
        costUsd: sql<number>`coalesce(sum(${llmCallLogs.costUsd}), 0)`.mapWith(Number),
      })
      .from(llmCallLogs)
      .groupBy(llmCallLogs.model)
      .orderBy(desc(sql`sum(${llmCallLogs.costUsd})`)),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${llmCallLogs.createdAt}), 'YYYY-MM-DD')`,
        calls: sql<number>`count(*)`.mapWith(Number),
        inputTokens: sql<number>`coalesce(sum(${llmCallLogs.inputTokens}), 0)`.mapWith(Number),
        outputTokens: sql<number>`coalesce(sum(${llmCallLogs.outputTokens}), 0)`.mapWith(Number),
        costUsd: sql<number>`coalesce(sum(${llmCallLogs.costUsd}), 0)`.mapWith(Number),
      })
      .from(llmCallLogs)
      .where(sql`${llmCallLogs.createdAt} >= ${since}`)
      .groupBy(sql`date_trunc('day', ${llmCallLogs.createdAt})`)
      .orderBy(desc(sql`date_trunc('day', ${llmCallLogs.createdAt})`)),
    db.select().from(llmCallLogs).orderBy(desc(llmCallLogs.createdAt)).limit(recentLimit),
  ]);

  return {
    byModel,
    byDay,
    recent: recent.map((r) => ({
      id: r.id,
      feature: r.feature,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      cacheReadTokens: r.cacheReadTokens,
      cacheCreationTokens: r.cacheCreationTokens,
      // numeric 컬럼은 postgres-js 가 문자열로 준다 (돈을 double 로 두지 않기 위한 선택).
      costUsd: Number(r.costUsd),
      cacheHit: r.cacheHit,
      latencyMs: r.latencyMs,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/** 공고 목록 (제출이 없는 공고도 보인다). */
export async function listPostings(limit = 200) {
  const rows = await db
    .select({
      id: jobPostings.id,
      company: jobPostings.company,
      title: jobPostings.title,
      createdAt: jobPostings.createdAt,
      submissionCount: sql<number>`(
        select count(*) from ${jdSubmissions}
        where ${jdSubmissions.jobPostingId} = ${jobPostings.id})`.mapWith(Number),
      requirementCount: sql<number>`(
        select count(*) from ${requirements}
        where ${requirements.jobPostingId} = ${jobPostings.id})`.mapWith(Number),
    })
    .from(jobPostings)
    .orderBy(desc(jobPostings.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
