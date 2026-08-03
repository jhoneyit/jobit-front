import { z } from "zod";

/**
 * 구조화 출력 스키마 (스펙 §7 미정 항목 "프롬프트 구조화 출력 스키마 상세 설계").
 *
 * 두 벌을 유지한다:
 *  - `*_JSON_SCHEMA` — Anthropic `output_config.format` 에 넘길 JSON Schema.
 *    구조화 출력이 지원하지 않는 제약(minItems/maximum/minLength 등)은 쓰지 않는다.
 *    개수·길이 같은 제약은 프롬프트에 글로 적는다.
 *  - `*Schema` (zod) — 응답을 **서버에서 다시 검증**하는 용도 (§6 엔지니어링 체크리스트).
 *    구조화 출력이 형태를 보장하더라도, 파싱 실패/모델 폴백 상황을 위해 한 번 더 막는다.
 */

// ─── JD 파싱 ──────────────────────────────────────────────────────────────

export const REQUIREMENT_KINDS = [
  "REQUIRED",
  "PREFERRED",
  "RESPONSIBILITY",
] as const;

export const parsedJdSchema = z.object({
  company: z.string().nullable(),
  title: z.string().nullable(),
  stack: z.array(z.string()),
  yearsOfExperience: z
    .object({
      min: z.number().nullable(),
      max: z.number().nullable(),
    })
    .nullable(),
  domain: z.string().nullable(),
  keywords: z.array(z.string()),
});

export const rawRequirementSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(REQUIREMENT_KINDS),
  keywords: z.array(z.string()),
});

export const jdParseResultSchema = z.object({
  parsed: parsedJdSchema,
  requirements: z.array(rawRequirementSchema),
});

export type JdParseResult = z.infer<typeof jdParseResultSchema>;
export type RawRequirement = z.infer<typeof rawRequirementSchema>;

export const JD_PARSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    parsed: {
      type: "object",
      properties: {
        company: {
          type: ["string", "null"],
          description: "회사명. 공고에 없으면 null",
        },
        title: {
          type: ["string", "null"],
          description: "채용 포지션명. 공고에 없으면 null",
        },
        stack: {
          type: "array",
          items: { type: "string" },
          description:
            "기술 스택. 공고에 명시된 것만. 정규화된 표기를 쓴다 (예: 'Spring Boot', 'Kubernetes', 'PostgreSQL')",
        },
        yearsOfExperience: {
          type: ["object", "null"],
          properties: {
            min: { type: ["integer", "null"] },
            max: { type: ["integer", "null"] },
          },
          required: ["min", "max"],
          additionalProperties: false,
          description:
            "요구 연차. '3년 이상'이면 {min:3,max:null}. 명시가 없으면 객체 전체를 null",
        },
        domain: {
          type: ["string", "null"],
          description: "서비스 도메인 한 줄 (예: '핀테크 결제', 'B2B SaaS 인프라')",
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "공고 전반을 대표하는 키워드 5~10개",
        },
      },
      required: [
        "company",
        "title",
        "stack",
        "yearsOfExperience",
        "domain",
        "keywords",
      ],
      additionalProperties: false,
    },
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "요구사항 한 줄. 공고 문장을 그대로 베끼지 말고 판정 가능한 형태로 정리한다",
          },
          kind: {
            type: "string",
            enum: REQUIREMENT_KINDS,
            description:
              "REQUIRED=자격요건, PREFERRED=우대사항, RESPONSIBILITY=담당업무",
          },
          keywords: {
            type: "array",
            items: { type: "string" },
            description: "이 요구사항 매칭에 쓸 키워드 1~5개",
          },
        },
        required: ["text", "kind", "keywords"],
        additionalProperties: false,
      },
    },
  },
  required: ["parsed", "requirements"],
  additionalProperties: false,
} as const;

// ─── 질문 생성 ────────────────────────────────────────────────────────────

export const QUESTION_CATEGORIES = [
  "CS",
  "STACK",
  "EXPERIENCE",
  "DESIGN",
  "CULTURE",
] as const;

export const rawQuestionSchema = z.object({
  /** 파싱된 requirement 배열에서의 0-based 인덱스. 매칭 안 되면 -1 */
  requirementIndex: z.number().int(),
  text: z.string().min(1),
  category: z.enum(QUESTION_CATEGORIES),
  difficulty: z.number().int().min(1).max(5),
  followups: z.array(z.string()),
  answerOutline: z.array(z.string()),
});

export type RawQuestion = z.infer<typeof rawQuestionSchema>;

export const questionsResultSchema = z.object({
  questions: z.array(rawQuestionSchema),
});

export const QUESTIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          requirementIndex: {
            type: "integer",
            description:
              "이 질문이 나온 요구사항의 번호(입력에 붙은 [n]). 특정 요구사항에서 나온 게 아니면 -1",
          },
          text: {
            type: "string",
            description: "면접관이 실제로 물어볼 법한 질문 한 문장",
          },
          category: {
            type: "string",
            enum: QUESTION_CATEGORIES,
            description:
              "CS=전산 기초, STACK=해당 스택 지식, EXPERIENCE=경험 확인, DESIGN=설계/트레이드오프, CULTURE=협업·일하는 방식",
          },
          difficulty: {
            type: "integer",
            enum: [1, 2, 3, 4, 5],
            description: "1=신입도 답할 수준, 5=시니어에게도 어려움",
          },
          followups: {
            type: "array",
            items: { type: "string" },
            description: "면접관이 이어서 물을 꼬리질문 1~3개",
          },
          answerOutline: {
            type: "array",
            items: { type: "string" },
            description:
              "답변 뼈대. 완성된 답변이 아니라 '무엇을 짚어야 하는지' 핵심 포인트 2~4개",
          },
        },
        required: [
          "requirementIndex",
          "text",
          "category",
          "difficulty",
          "followups",
          "answerOutline",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;
