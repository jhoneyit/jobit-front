import { createHash } from "node:crypto";

/**
 * 스펙 §4.1 1단계: 본문 정규화 (공백·특수문자 정리) → 해시.
 *
 * 정규화의 목적은 "같은 공고를 다른 사람이 붙여넣었을 때 같은 해시가 나오게" 하는 것.
 * 복붙 과정에서 흔히 달라지는 것만 지운다 — 의미를 바꾸는 정규화는 하지 않는다.
 */
export function normalizeJd(raw: string): string {
  return (
    raw
      // 윈도우/맥 줄바꿈 통일
      .replace(/\r\n?/g, "\n")
      // 제로폭 문자 (웹 복붙 시 자주 섞임)
      .replace(/[​-‍﻿]/g, "")
      // 논브레이킹 스페이스 → 일반 공백
      .replace(/ /g, " ")
      // 유니코드 따옴표/대시 통일
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      // 불릿 기호 통일 (·, •, ▪, ‣, ◦ → -)
      .replace(/^[ \t]*[·•▪‣◦∙]\s*/gm, "- ")
      // 줄 끝 공백 제거
      .replace(/[ \t]+$/gm, "")
      // 줄 안의 연속 공백 축약
      .replace(/[ \t]{2,}/g, " ")
      // 3줄 이상 빈 줄 → 2줄
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** 정규화된 본문의 SHA-256. job_posting.content_hash 로 쓰이는 캐시 키. */
export function contentHash(normalized: string): string {
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export const MIN_JD_LENGTH = 80;
export const MAX_JD_LENGTH = 20_000;

export type JdValidation =
  | { ok: true; normalized: string; hash: string }
  | { ok: false; reason: string };

export function validateAndNormalize(raw: string): JdValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "공고 본문이 필요합니다." };
  }
  const normalized = normalizeJd(raw);
  if (normalized.length < MIN_JD_LENGTH) {
    return {
      ok: false,
      reason: `공고 본문이 너무 짧습니다. (최소 ${MIN_JD_LENGTH}자, 현재 ${normalized.length}자)`,
    };
  }
  if (normalized.length > MAX_JD_LENGTH) {
    return {
      ok: false,
      reason: `공고 본문이 너무 깁니다. (최대 ${MAX_JD_LENGTH}자, 현재 ${normalized.length}자)`,
    };
  }
  return { ok: true, normalized, hash: contentHash(normalized) };
}
