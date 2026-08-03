import type { Requirement, RequirementKind } from "@/lib/types";

const KIND_LABEL: Record<RequirementKind, string> = {
  REQUIRED: "자격요건",
  PREFERRED: "우대사항",
  RESPONSIBILITY: "담당업무",
};

/**
 * 요구사항 목록. 스펙 §3 "requirement 가 모든 것의 연결 고리"라는 구조를
 * 화면에서도 드러낸다 — 질문 카드가 각자 여기 항목을 가리킨다.
 */
export default function RequirementList({
  requirements,
}: {
  requirements: Requirement[];
}) {
  if (requirements.length === 0) {
    return (
      <div className="notice" data-tone="info">
        공고에서 요구사항을 뽑아내지 못했습니다.
      </div>
    );
  }

  return (
    <ul className="req-list">
      {requirements.map((r) => (
        <li className="req-item" key={r.id}>
          <span className="kind" data-kind={r.kind}>
            {KIND_LABEL[r.kind]}
          </span>
          <span>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}
