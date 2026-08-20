"use client";

import { useTransition } from "react";
import { removeVideoSubmission } from "@/app/actions/videos";

export default function DeleteVideoButton({
  summaryId,
  label,
}: {
  summaryId: string;
  label: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="row-delete"
      disabled={pending}
      aria-label={`${label} 요약을 목록에서 삭제`}
      onClick={() => {
        if (!confirm(`"${label}" 요약을 내 목록에서 지울까요?`)) return;
        start(() => {
          void removeVideoSubmission(summaryId);
        });
      }}
    >
      {pending ? "삭제 중" : "삭제"}
    </button>
  );
}
