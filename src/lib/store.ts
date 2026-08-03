import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  jdSubmissions,
  jobPostings,
  questions as questionsTable,
  questionSets,
  requirements as requirementsTable,
} from "@/lib/db/schema";
import type {
  JobPosting,
  Question,
  QuestionSet,
  Requirement,
  SubmissionListItem,
} from "@/lib/types";

/**
 * 저장소 계층 — Postgres(Drizzle).
 *
 * 1단계에서는 메모리 Map 이었고, 호출부가 이 파일의 함수만 쓰도록 막아 뒀다.
 * 그래서 DB 로 갈아끼우면서 바뀐 건 **여기 내부와 `await` 뿐**이다.
 */

// ─── 공고 ─────────────────────────────────────────────────────────────────

/** §4.1 2단계: content_hash 로 조회 → 있으면 그대로 재사용 */
export async function findJobPostingByHash(
  hash: string,
): Promise<JobPosting | null> {
  const [row] = await db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.contentHash, hash))
    .limit(1);
  return row ? toJobPosting(row) : null;
}

export async function getJobPosting(id: string): Promise<JobPosting | null> {
  const [row] = await db
    .select()
    .from(jobPostings)
    .where(eq(jobPostings.id, id))
    .limit(1);
  return row ? toJobPosting(row) : null;
}

/**
 * 공고 + 요구사항을 한 트랜잭션으로 저장한다.
 *
 * 동시에 같은 공고가 들어오면 content_hash unique 제약에 걸린다. 그때는 에러를 내지 않고
 * 먼저 들어간 로우를 돌려준다 — 사용자 입장에서는 캐시 적중과 구분할 이유가 없다.
 */
export async function saveJobPosting(
  posting: Omit<JobPosting, "id" | "createdAt">,
  reqs: Omit<Requirement, "id" | "jobPostingId">[],
): Promise<{ posting: JobPosting; requirements: Requirement[] }> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(jobPostings)
      .values({
        contentHash: posting.contentHash,
        rawText: posting.rawText,
        sourceUrl: posting.sourceUrl,
        company: posting.company,
        title: posting.title,
        parsed: posting.parsed,
      })
      .onConflictDoNothing({ target: jobPostings.contentHash })
      .returning();

    // 경합에서 졌다 → 먼저 들어간 쪽 것을 쓴다
    if (!inserted) {
      const [existing] = await tx
        .select()
        .from(jobPostings)
        .where(eq(jobPostings.contentHash, posting.contentHash))
        .limit(1);
      const existingReqs = await tx
        .select()
        .from(requirementsTable)
        .where(eq(requirementsTable.jobPostingId, existing.id))
        .orderBy(requirementsTable.sortOrder);
      return {
        posting: toJobPosting(existing),
        requirements: existingReqs.map(toRequirement),
      };
    }

    const insertedReqs = reqs.length
      ? await tx
          .insert(requirementsTable)
          .values(
            reqs.map((r) => ({
              jobPostingId: inserted.id,
              text: r.text,
              kind: r.kind,
              keywords: r.keywords,
              sortOrder: r.sortOrder,
            })),
          )
          .returning()
      : [];

    return {
      posting: toJobPosting(inserted),
      requirements: insertedReqs.map(toRequirement),
    };
  });
}

export async function getRequirements(
  jobPostingId: string,
): Promise<Requirement[]> {
  const rows = await db
    .select()
    .from(requirementsTable)
    .where(eq(requirementsTable.jobPostingId, jobPostingId))
    .orderBy(requirementsTable.sortOrder);
  return rows.map(toRequirement);
}

// ─── 제출 이력 (회원별 조회의 근거) ───────────────────────────────────────

/**
 * "이 사람이 이 공고를 넣었다"를 기록한다.
 * 같은 사람이 같은 공고를 다시 넣으면 새 줄을 만들지 않고 시각만 갱신한다 —
 * 목록에 같은 공고가 여러 번 뜨는 게 더 불편하다.
 */
export async function recordSubmission(
  ownerKey: string,
  jobPostingId: string,
): Promise<void> {
  await db
    .insert(jdSubmissions)
    .values({ ownerKey, jobPostingId })
    .onConflictDoUpdate({
      target: [jdSubmissions.ownerKey, jdSubmissions.jobPostingId],
      set: { createdAt: sql`now()` },
    });
}

/** 내 기록 목록. 질문 생성 여부까지 한 번에 가져온다 (N+1 방지). */
export async function listSubmissions(
  ownerKey: string,
  limit = 50,
): Promise<SubmissionListItem[]> {
  const rows = await db
    .select({
      jobPostingId: jobPostings.id,
      company: jobPostings.company,
      title: jobPostings.title,
      parsed: jobPostings.parsed,
      submittedAt: jdSubmissions.createdAt,
      requirementCount: sql<number>`(
        select count(*) from ${requirementsTable}
        where ${requirementsTable.jobPostingId} = ${jobPostings.id}
      )`.mapWith(Number),
      questionCount: sql<number>`(
        select count(*) from ${questionsTable}
        join ${questionSets} on ${questionSets.id} = ${questionsTable.questionSetId}
        where ${questionSets.jobPostingId} = ${jobPostings.id}
      )`.mapWith(Number),
    })
    .from(jdSubmissions)
    .innerJoin(jobPostings, eq(jobPostings.id, jdSubmissions.jobPostingId))
    .where(eq(jdSubmissions.ownerKey, ownerKey))
    .orderBy(desc(jdSubmissions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    jobPostingId: r.jobPostingId,
    company: r.company,
    title: r.title,
    stack: r.parsed.stack ?? [],
    domain: r.parsed.domain,
    submittedAt: r.submittedAt.toISOString(),
    requirementCount: r.requirementCount,
    questionCount: r.questionCount,
  }));
}

/** 이 공고가 내 기록에 있는지 — 결과 페이지 접근 판정용. */
export async function ownsSubmission(
  ownerKey: string,
  jobPostingId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: jdSubmissions.id })
    .from(jdSubmissions)
    .where(
      and(
        eq(jdSubmissions.ownerKey, ownerKey),
        eq(jdSubmissions.jobPostingId, jobPostingId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function deleteSubmission(
  ownerKey: string,
  jobPostingId: string,
): Promise<void> {
  await db
    .delete(jdSubmissions)
    .where(
      and(
        eq(jdSubmissions.ownerKey, ownerKey),
        eq(jdSubmissions.jobPostingId, jobPostingId),
      ),
    );
}

/**
 * 로그인 전에 익명으로 쌓아 둔 기록을 계정으로 승계한다.
 *
 * 이게 없으면 "질문 만들어 보고 마음에 들어서 로그인했더니 방금 만든 게 사라진" 상태가 된다.
 * 이미 계정에 같은 공고가 있으면 익명 쪽 줄은 그냥 버린다 (unique 충돌).
 * 반환값은 실제로 옮겨진 개수.
 */
export async function claimAnonSubmissions(
  anonKey: string,
  userKey: string,
): Promise<number> {
  const moved = await db
    .update(jdSubmissions)
    .set({ ownerKey: userKey })
    .where(
      and(
        eq(jdSubmissions.ownerKey, anonKey),
        // 계정에 이미 있는 공고는 건드리지 않는다 — unique 제약에 걸린다
        sql`not exists (
          select 1 from ${jdSubmissions} existing
          where existing.owner_key = ${userKey}
            and existing.job_posting_id = ${jdSubmissions.jobPostingId}
        )`,
      ),
    )
    .returning({ id: jdSubmissions.id });

  // 옮기지 못한 (= 계정에 이미 있던) 익명 줄은 정리한다
  await db.delete(jdSubmissions).where(eq(jdSubmissions.ownerKey, anonKey));

  return moved.length;
}

// ─── 질문 ─────────────────────────────────────────────────────────────────

export async function saveQuestionSet(
  set: Omit<QuestionSet, "id" | "createdAt">,
  qs: Omit<Question, "id" | "questionSetId">[],
): Promise<QuestionSet> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(questionSets)
      .values({
        jobPostingId: set.jobPostingId,
        promptVersion: set.promptVersion,
        model: set.model,
      })
      .onConflictDoNothing({
        target: [questionSets.jobPostingId, questionSets.promptVersion],
      })
      .returning();

    // 동시에 같은 공고로 생성이 돌았다 → 먼저 저장된 세트를 쓴다
    if (!inserted) {
      const [existing] = await tx
        .select()
        .from(questionSets)
        .where(
          and(
            eq(questionSets.jobPostingId, set.jobPostingId),
            eq(questionSets.promptVersion, set.promptVersion),
          ),
        )
        .limit(1);
      return toQuestionSet(existing);
    }

    if (qs.length) {
      await tx.insert(questionsTable).values(
        qs.map((q, i) => ({
          questionSetId: inserted.id,
          requirementId: q.requirementId,
          text: q.text,
          category: q.category,
          difficulty: q.difficulty,
          followups: q.followups,
          answerOutline: q.answerOutline,
          sortOrder: i,
        })),
      );
    }

    return toQuestionSet(inserted);
  });
}

/**
 * §4.2 "prompt_version 이 같으면 재생성하지 않는다."
 */
export async function getCachedQuestions(
  jobPostingId: string,
  promptVersion: string,
): Promise<{ set: QuestionSet; questions: Question[] } | null> {
  const [set] = await db
    .select()
    .from(questionSets)
    .where(
      and(
        eq(questionSets.jobPostingId, jobPostingId),
        eq(questionSets.promptVersion, promptVersion),
      ),
    )
    .limit(1);
  if (!set) return null;

  const rows = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.questionSetId, set.id))
    .orderBy(questionsTable.sortOrder);
  if (rows.length === 0) return null;

  return { set: toQuestionSet(set), questions: rows.map(toQuestion) };
}

// ─── row → 도메인 타입 ────────────────────────────────────────────────────

type JobPostingRow = typeof jobPostings.$inferSelect;
type RequirementRow = typeof requirementsTable.$inferSelect;
type QuestionSetRow = typeof questionSets.$inferSelect;
type QuestionRow = typeof questionsTable.$inferSelect;

function toJobPosting(r: JobPostingRow): JobPosting {
  return {
    id: r.id,
    contentHash: r.contentHash,
    rawText: r.rawText,
    sourceUrl: r.sourceUrl,
    company: r.company,
    title: r.title,
    parsed: r.parsed,
    createdAt: r.createdAt.toISOString(),
  };
}

function toRequirement(r: RequirementRow): Requirement {
  return {
    id: r.id,
    jobPostingId: r.jobPostingId,
    text: r.text,
    kind: r.kind,
    keywords: r.keywords,
    sortOrder: r.sortOrder,
  };
}

function toQuestionSet(r: QuestionSetRow): QuestionSet {
  return {
    id: r.id,
    jobPostingId: r.jobPostingId,
    promptVersion: r.promptVersion,
    model: r.model,
    createdAt: r.createdAt.toISOString(),
  };
}

function toQuestion(r: QuestionRow): Question {
  return {
    id: r.id,
    questionSetId: r.questionSetId,
    requirementId: r.requirementId,
    text: r.text,
    category: r.category,
    difficulty: r.difficulty,
    followups: r.followups,
    answerOutline: r.answerOutline,
  };
}
