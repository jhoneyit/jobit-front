import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { LlmFeature, ParsedJd, QuestionCategory, RequirementKind } from "@/lib/types";

/**
 * 스펙 §3 데이터 모델의 Drizzle 구현.
 *
 * ## ⚠️ 이 파일은 더 이상 스키마의 정본이 아니다 (2026-08-04 DB 단일화)
 *
 * 스키마 소유권은 **`jobit` 쪽 Flyway** 에 있다 (`jobit/src/main/resources/db/migration/`).
 * 한 DB 에 마이그레이션 도구가 둘이면 반드시 어긋나므로 `drizzle-kit` 은 마이그레이션에서
 * 손을 뗐다. 이 파일은 **Flyway 가 만든 테이블을 읽고 쓰기 위한 타입 선언**일 뿐이다.
 *
 * 컬럼을 바꾸려면 여기가 아니라 Flyway 에 마이그레이션을 추가하고, 그 다음 이 파일을 맞춘다.
 * 순서를 뒤집으면 런타임에 "column does not exist" 로 터진다.
 *
 * **enum 은 Postgres 네이티브 타입이 아니라 varchar + CHECK 다.** 값을 추가할 때 ALTER TYPE
 * 없이 마이그레이션 한 줄로 끝나기 때문이다 (Flyway V2 결정). Drizzle 쪽은 `$type<>` 로
 * 타입 안전성만 확보한다 — DB 제약은 CHECK 가 건다.
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

/** DB 는 varchar(20) + CHECK 로 제약한다 (Flyway V2). 여기서는 타입만 좁힌다. */
const requirementKind = (name: string) => varchar(name, { length: 20 }).$type<RequirementKind>();

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

/** DB 는 varchar(20) + CHECK (Flyway V2). */
const questionCategory = (name: string) => varchar(name, { length: 20 }).$type<QuestionCategory>();

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

/** DB 는 varchar(40) (Flyway V2). */
const llmFeature = (name: string) => varchar(name, { length: 40 }).$type<LlmFeature>();

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
    // Flyway 는 numeric(12,6) 이다. postgres-js 가 numeric 을 문자열로 돌려주므로
    // 읽는 쪽에서 Number() 로 바꿔 쓴다 — 돈을 double 로 두지 않기 위한 의도된 선택이다.
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    cacheHit: boolean("cache_hit").notNull().default(false),
    latencyMs: integer("latency_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("llm_call_log_created_idx").on(t.createdAt)],
);

// ─── 내 정보 (프로필) ─────────────────────────────────────────────────────

/**
 * 공고가 알 수 없는 지원자 본인의 정보 (Flyway V8).
 *
 * 소유자당 한 행이라 `owner_key` 가 곧 PK 다. 파싱이 뽑아내는 건 전부 "공고가 원하는 것"이고,
 * "내가 실제로 다뤄본 것"은 여기에만 있다 — 이 둘이 있어야 교집합/차집합이 나온다.
 *
 * **질문 생성 프롬프트에는 넣지 않는다.** 넣으면 `question_set` 캐시 키에 프로필이 붙어
 * 인기 공고도 사용자마다 재생성된다. 이 값은 이미 만들어진 질문을 정렬·강조하는
 * 표시 단계에서만 쓴다 (`lib/profile/match.ts`).
 */
export const userProfiles = pgTable("user_profile", {
  ownerKey: varchar("owner_key", { length: 255 }).primaryKey(),
  /** 미입력이면 null. 0(신입)과 구분해야 하므로 기본값을 두지 않는다. */
  yearsOfExp: smallint("years_of_exp"),
  /** 사용자가 적은 표기 그대로. 정규화·별칭 해석은 읽는 쪽(match.ts)이 한다. */
  stacks: jsonb("stacks").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
