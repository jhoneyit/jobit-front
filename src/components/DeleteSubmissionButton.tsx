"use client";

import { useTransition } from "react";
import { removeSubmission } from "@/app/actions/submissions";

export default function DeleteSubmissionButton({
  jobPostingId,
  label,
}: {
  jobPostingId: string;
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
          void removeSubmission(jobPostingId);
        });
      }}
    >
      {pending ? "삭제 중" : "삭제"}
    </button>
  );
}
