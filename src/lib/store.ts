import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
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

// ─── 제출 이력 ────────────────────────────────────────────────────────────
//
// 여기 있었다. 2026-08-07 에 `jobit` 백엔드로 옮겼다 — `@/lib/submissions` 참고.
// 같은 테이블을 두 레포가 각자 다루면 규칙이 조용히 갈라진다. 실제로 승계 규칙이 갈라져
// 있었다: 이쪽은 남은 익명 줄을 전부 지웠고, 저쪽은 충돌한 줄만 지운다.
//
// 관리자 콘솔은 `@/lib/admin/queries` 로 여전히 DB 를 직접 읽는다. 운영용 화면이라
// 사용자 경로와 요구가 다르고(전체 조회), 아직 백엔드에 대응 엔드포인트가 없다.

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
