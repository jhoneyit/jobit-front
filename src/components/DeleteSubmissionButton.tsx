"use client";

import { useTransition } from "react";
import { removeSubmission } from "@/app/actions/submissions";

export default function DeleteSubmissionButton({
  submissionId,
  label,
}: {
  /** 공고 id 가 아니다 — 같은 공고를 여러 사람이 갖고 있어 한 줄을 지목하지 못한다 */
  submissionId: string;
  label: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="row-delete"
      disabled={pending}
      aria-label={`${label} 기록에서 삭제`}
      onClick={() => {
        if (!confirm(`"${label}" 을(를) 목록에서 지울까요?`)) return;
        start(() => {
          void removeSubmission(submissionId);
        });
      }}
    >
      {pending ? "삭제 중" : "삭제"}
    </button>
  );
}
