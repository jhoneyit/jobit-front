import type { RequirementFit } from "@/lib/profile/types";
import type { Requirement, RequirementKind } from "@/lib/types";

const KIND_LABEL: Record<RequirementKind, string> = {
  REQUIRED: "자격요건",
  PREFERRED: "우대사항",
  RESPONSIBILITY: "담당업무",
};

/**
 * 요구사항 목록. 스펙 §3 "requirement 가 모든 것의 연결 고리"라는 구조를
 * 화면에서도 드러낸다 — 질문 카드가 각자 여기 항목을 가리킨다.
 *
 * `fits` 가 있으면 내 보유 스택과의 관계를 배지로 덧붙인다. **NEUTRAL 에는 아무것도 붙이지
 * 않는다** — 기술 이야기가 아닌 항목("코드 리뷰 문화에 익숙하신 분")에 판정을 붙이면
 * 있지도 않은 근거를 말하는 셈이 된다.
 */
export default function RequirementList({
  requirements,
  fits,
}: {
  requirements: Requirement[];
  fits?: Record<string, RequirementFit>;
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
      {requirements.map((r) => {
        const fit = fits?.[r.id];
        return (
          <li className="req-item" key={r.id}>
            <span className="kind" data-kind={r.kind}>
              {KIND_LABEL[r.kind]}
            </span>
            <span>
              {r.text}
              {fit?.fit === "MATCHED" && (
                <span
                  className="fit-badge"
                  data-fit="MATCHED"
                  title={`내 보유 스택: ${fit.matchedStacks.join(", ")}`}
                >
                  경험 있음
                </span>
              )}
              {fit?.fit === "UNMATCHED" && (
                <span className="fit-badge" data-fit="UNMATCHED">
                  내 스택 아님
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
