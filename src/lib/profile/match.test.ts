import { describe, expect, it } from "vitest";
import { fitYears, matchProfile, questionPriority, tokenize } from "@/lib/profile/match";
import type { ParsedJd, Requirement } from "@/lib/types";

/** 테스트용 요구사항. id 는 판정 결과를 되찾는 키라서 의미 있는 값을 준다. */
function req(id: string, text: string, keywords: string[] = []): Requirement {
  return { id, jobPostingId: "jp", text, kind: "REQUIRED", keywords, sortOrder: 0 };
}

function parsed(stack: string[], years: ParsedJd["yearsOfExperience"] = null): ParsedJd {
  return {
    company: null,
    title: null,
    stack,
    yearsOfExperience: years,
    domain: null,
    keywords: [],
  };
}

describe("tokenize", () => {
  it("점·하이픈·언더스코어를 지워 한 토큰으로 붙인다", () => {
    expect(tokenize("Node.js")).toEqual(["nodejs"]);
    expect(tokenize("spring-boot")).toEqual(["springboot"]);
  });

  it("+ 와 # 는 남긴다", () => {
    expect(tokenize("C++")).toEqual(["c++"]);
    expect(tokenize("C#")).toEqual(["c#"]);
  });

  it("별칭을 같은 표기로 모은다", () => {
    expect(tokenize("K8s")).toEqual(["kubernetes"]);
    expect(tokenize("TS")).toEqual(["typescript"]);
    expect(tokenize("쿠버네티스")).toEqual(["kubernetes"]);
    expect(tokenize("Postgres")).toEqual(["postgresql"]);
  });

  it("영문에 붙은 조사를 떼어 낸다 — 실제 공고에서 매칭이 깨지던 지점", () => {
    expect(tokenize("Spring Boot로 REST API 설계")).toEqual([
      "spring",
      "boot",
      "로",
      "rest",
      "api",
      "설계",
    ]);
    expect(tokenize("Java를 다뤄본")).toEqual(["java", "를", "다뤄본"]);
    expect(tokenize("Kafka와 Redis")).toEqual(["kafka", "와", "redis"]);
  });

  it("한글 문장에서 기술 토큰을 골라낸다", () => {
    expect(tokenize("Java 또는 Kotlin 기반 개발 경험")).toEqual([
      "java",
      "또는",
      "kotlin",
      "기반",
      "개발",
      "경험",
    ]);
  });
});

describe("matchProfile — 스택 판정", () => {
  const jd = parsed(["Java", "Spring Boot", "Kubernetes"]);

  it("보유 스택이 등장하면 MATCHED 이고 근거를 돌려준다", () => {
    const r = req("r1", "Java 또는 Kotlin 기반 백엔드 개발 경험");
    const fit = matchProfile({ yearsOfExp: 5, stacks: ["Java"] }, jd, [r]);

    expect(fit.byRequirement["r1"]).toEqual({
      requirementId: "r1",
      fit: "MATCHED",
      matchedStacks: ["Java"],
    });
    expect(fit.matchedCount).toBe(1);
  });

  it("공고 기술을 말하는데 내 것과 겹치지 않으면 UNMATCHED", () => {
    const r = req("r1", "Kubernetes 운영 경험");
    const fit = matchProfile({ yearsOfExp: 5, stacks: ["Java"] }, jd, [r]);

    expect(fit.byRequirement["r1"]?.fit).toBe("UNMATCHED");
    expect(fit.unmatchedCount).toBe(1);
  });

  it("기술 이야기가 아닌 요구사항은 NEUTRAL — 여기가 2-state 로 두면 망가지는 지점", () => {
    const r = req("r1", "코드 리뷰 문화에 익숙하신 분");
    const fit = matchProfile({ yearsOfExp: 5, stacks: ["Java"] }, jd, [r]);

    expect(fit.byRequirement["r1"]?.fit).toBe("NEUTRAL");
    expect(fit.unmatchedCount).toBe(0);
  });

  it("파싱이 놓친 기술은 UNMATCHED 가 아니라 NEUTRAL 로 떨어진다", () => {
    // 공고 stack 에 Redis 가 없다 → 없는 근거로 "당신 스택이 아님" 이라고 말하지 않는다
    const r = req("r1", "Redis 캐시 운영 경험");
    const fit = matchProfile({ yearsOfExp: 5, stacks: ["Java"] }, jd, [r]);

    expect(fit.byRequirement["r1"]?.fit).toBe("NEUTRAL");
  });

  it("토큰 단위로 비교하므로 Go 가 MongoDB 에 걸리지 않는다", () => {
    const mongoJd = parsed(["MongoDB"]);
    const r = req("r1", "MongoDB 운영 경험");
    const fit = matchProfile({ yearsOfExp: 3, stacks: ["Go"] }, mongoJd, [r]);

    expect(fit.byRequirement["r1"]?.fit).toBe("UNMATCHED");
    expect(fit.matchedCount).toBe(0);
  });

  it("여러 단어짜리 스택은 연속으로 나올 때만 걸린다", () => {
    const r = req("r1", "Spring Boot 실무 경험");
    expect(
      matchProfile({ yearsOfExp: 3, stacks: ["Spring Boot"] }, jd, [r]).byRequirement["r1"]?.fit,
    ).toBe("MATCHED");

    const looser = req("r2", "Spring 경험");
    expect(
      matchProfile({ yearsOfExp: 3, stacks: ["Spring Boot"] }, jd, [looser]).byRequirement["r2"]
        ?.fit,
    ).toBe("NEUTRAL");
  });

  it("별칭이 양쪽에 똑같이 적용된다", () => {
    const r = req("r1", "Kubernetes 운영 경험");
    const fit = matchProfile({ yearsOfExp: 5, stacks: ["k8s"] }, jd, [r]);

    expect(fit.byRequirement["r1"]?.fit).toBe("MATCHED");
  });

  it("요구사항 keywords 도 근거로 본다", () => {
    const r = req("r1", "컨테이너 오케스트레이션 운영", ["Kubernetes"]);
    const fit = matchProfile({ yearsOfExp: 5, stacks: ["Kubernetes"] }, jd, [r]);

    expect(fit.byRequirement["r1"]?.fit).toBe("MATCHED");
  });

  it("보유 스택이 비어 있으면 판정 자체를 하지 않는다", () => {
    const r = req("r1", "Kubernetes 운영 경험");
    const fit = matchProfile({ yearsOfExp: 5, stacks: [] }, jd, [r]);

    expect(Object.keys(fit.byRequirement).length).toBe(0);
    expect(fit.unmatchedCount).toBe(0);
  });

  it("공백만 있는 스택은 무시한다", () => {
    const r = req("r1", "Kubernetes 운영 경험");
    const fit = matchProfile({ yearsOfExp: 5, stacks: ["   "] }, jd, [r]);

    expect(Object.keys(fit.byRequirement).length).toBe(0);
  });
});

describe("fitYears", () => {
  it("요구 연차보다 낮으면 BELOW", () => {
    expect(fitYears(2, { min: 3, max: null })).toBe("BELOW");
  });

  it("요구 연차보다 높으면 ABOVE", () => {
    expect(fitYears(9, { min: 3, max: 7 })).toBe("ABOVE");
  });

  it("범위 안이면 WITHIN", () => {
    expect(fitYears(5, { min: 3, max: 7 })).toBe("WITHIN");
    expect(fitYears(5, { min: 3, max: null })).toBe("WITHIN");
  });

  it("한쪽이라도 없으면 비교하지 않는다", () => {
    expect(fitYears(null, { min: 3, max: null })).toBe("UNKNOWN");
    expect(fitYears(5, null)).toBe("UNKNOWN");
    expect(fitYears(5, { min: null, max: null })).toBe("UNKNOWN");
  });

  it("신입(0년)은 미입력과 다르게 취급한다", () => {
    expect(fitYears(0, { min: 3, max: null })).toBe("BELOW");
  });
});

describe("questionPriority", () => {
  it("근거를 준비해야 하는 것부터 앞에 온다", () => {
    const unmatched = { requirementId: "a", fit: "UNMATCHED" as const, matchedStacks: [] };
    const neutral = { requirementId: "b", fit: "NEUTRAL" as const, matchedStacks: [] };
    const matched = { requirementId: "c", fit: "MATCHED" as const, matchedStacks: ["Java"] };

    expect(questionPriority(unmatched)).toBeLessThan(questionPriority(neutral));
    expect(questionPriority(neutral)).toBeLessThan(questionPriority(matched));
  });

  it("매핑되지 않은 일반 질문은 가운데에 둔다", () => {
    const matched = { requirementId: "c", fit: "MATCHED" as const, matchedStacks: [] };
    expect(questionPriority(undefined)).toBeLessThan(questionPriority(matched));
  });
});
