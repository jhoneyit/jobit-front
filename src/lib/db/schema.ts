import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { ParsedJd } from "@/lib/types";

/**
 * 스펙 §3 데이터 모델의 Drizzle 구현.
 *
 * 스펙 SQL 과 다른 점은 두 가지뿐이고, 둘 다 이유가 있다:
 *  1) Auth.js 표준 테이블(user/account/session/verificationToken)이 추가됐다 — GitHub OAuth 용.
 *  2) `jd_submission` 테이블이 추가됐다 — 아래 주석 참고. 스펙에는 없지만
 *     "회원이 자기가 넣은 JD 를 조회한다"를 캐시(§4.1)를 깨지 않고 구현하려면 필요하다.
 */

// ─── Auth.js 표준 테이블 ──────────────────────────────────────────────────

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date", withTimezone: true }),
  image: text("image"),
  /**
   * 이메일+비밀번호 가입자만 값이 있다. GitHub 로만 가입한 사용자는 null.
   * 형식은 `scrypt$N$r$p$salt$hash` — lib/auth/password.ts 참고.
   */
  passwordHash: text("password_hash"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/**
 * 비밀번호 재설정 토큰.
 *
 * **원문이 아니라 SHA-256 해시를 저장한다.** DB 가 유출돼도 그 값으로는 재설정할 수 없다.
 * (비밀번호와 달리 scrypt 같은 느린 해시가 필요 없다 — 토큰은 32바이트 난수라
 *  무차별 대입 자체가 불가능하고, 검증은 요청마다 일어나므로 빨라야 한다.)
 *
 * Auth.js 의 verificationToken 테이블을 쓰지 않는 이유: 그건 어댑터가 매직링크용으로
 * 관리하는 영역이라, 우리 재설정 흐름이 끼어들면 만료·삭제 규칙이 섞인다.
 */
export const passwordResetTokens = pgTable(
  "password_reset_token",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** 1회용. 쓰고 나면 시각을 남겨 재사용을 막는다. */
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_reset_user_idx").on(t.userId, t.createdAt)],
);

// ─── §3.1 공고 ────────────────────────────────────────────────────────────

export const requirementKind = pgEnum("requirement_kind", [
  "REQUIRED",
  "PREFERRED",
  "RESPONSIBILITY",
]);

/**
 * 공고는 **전역적으로 하나**다. content_hash 로 중복 제거한다 (§4.1).
 * 같은 공고를 열 명이 붙여넣어도 job_posting 로우는 하나 — 그게 캐시의 전제다.
 * "누가 넣었는가"는 job_posting 이 아니라 jd_submission 이 들고 있다.
 */
export const jobPostings = pgTable(
  "job_posting",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentHash: text("content_hash").notNull().unique(),
    rawText: text("raw_text").notNull(),
    sourceUrl: text("source_url"),
    company: text("company"),
    title: text("title"),
    parsed: jsonb("parsed").$type<ParsedJd>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_posting_created_idx").on(t.createdAt)],
);

export const requirements = pgTable(
  "requirement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostingId: uuid("job_posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    kind: requirementKind("kind").notNull(),
    keywords: text("keywords").array().notNull().default([]),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("requirement_posting_idx").on(t.jobPostingId, t.sortOrder)],
);

// ─── 제출 이력 (스펙에 없는 추가 테이블) ──────────────────────────────────

/**
 * "이 사용자가 이 공고를 언제 넣었는가."
 *
 * 왜 job_posting 에 owner_key 컬럼을 넣지 않았는가:
 *   §4.1 의 캐시는 "같은 공고 = 같은 로우"에 기대고 있다. job_posting 에 소유자를 달면
 *   같은 공고를 두 사람이 넣을 때 로우를 두 개 만들어야 하고, 그 순간 content_hash unique 와
 *   캐시 적중률이 동시에 무너진다. 그래서 공고(공유 자산)와 제출 이력(개인 자산)을 분리했다.
 *
 * owner_key 는 §3.3 의 `resume.owner_key` 와 같은 규약을 쓴다 — 익명 세션 키 또는 user_id.
 * 로그인 전에 쌓인 익명 기록은 로그인 시점에 user_id 로 승계된다 (auth.ts 참고).
 */
export const jdSubmissions = pgTable(
  "jd_submission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 익명 세션 키(anon:<uuid>) 또는 user:<user_id> */
    ownerKey: text("owner_key").notNull(),
    jobPostingId: uuid("job_posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 목록 조회: 내 것만, 최신순
    index("jd_submission_owner_idx").on(t.ownerKey, t.createdAt),
    // 같은 사람이 같은 공고를 여러 번 넣어도 목록에는 한 줄만
    uniqueIndex("jd_submission_owner_posting_uq").on(t.ownerKey, t.jobPostingId),
  ],
);

// ─── §3.2 면접 질문 ───────────────────────────────────────────────────────

export const questionCategory = pgEnum("question_category", [
  "CS",
  "STACK",
  "EXPERIENCE",
  "DESIGN",
  "CULTURE",
]);

export const questionSets = pgTable(
  "question_set",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobPostingId: uuid("job_posting_id")
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // §4.2 "prompt_version 이 같으면 재생성하지 않는다" 조회용.
    // 공고 × 프롬프트 버전당 세트는 하나여야 동시 요청이 중복 생성하지 않는다.
    uniqueIndex("question_set_posting_version_uq").on(t.jobPostingId, t.promptVersion),
  ],
);

export const questions = pgTable(
  "question",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionSetId: uuid("question_set_id")
      .notNull()
      .references(() => questionSets.id, { onDelete: "cascade" }),
    requirementId: uuid("requirement_id").references(() => requirements.id, {
      onDelete: "set null",
    }),
    text: text("text").notNull(),
    category: questionCategory("category").notNull(),
    difficulty: smallint("difficulty").notNull(),
    followups: jsonb("followups").$type<string[]>().notNull().default([]),
    answerOutline: jsonb("answer_outline").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("question_set_idx").on(t.questionSetId, t.sortOrder)],
);

// ─── §3.5 비용 추적 ───────────────────────────────────────────────────────

export const llmFeature = pgEnum("llm_feature", [
  "JD_PARSE",
  "QUESTION_GEN",
  "GAP_ANALYSIS",
  "REWRITE",
]);

export const llmCallLogs = pgTable(
  "llm_call_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feature: llmFeature("feature").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheCreationTokens: integer("cache_creation_tokens").notNull().default(0),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    cacheHit: boolean("cache_hit").notNull().default(false),
    latencyMs: integer("latency_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("llm_call_log_created_idx").on(t.createdAt)],
);
