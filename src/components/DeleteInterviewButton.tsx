"use client";

import { useTransition } from "react";
import { removeInterview } from "@/app/actions/interviews";

export default function DeleteInterviewButton({
  sessionId,
  label,
}: {
  sessionId: string;
  label: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="row-delete"
      disabled={pending}
      aria-label={`${label} 면접 기록 삭제`}
      onClick={() => {
        if (!confirm(`"${label}" 연습 기록을 지울까요?`)) return;
        start(() => {
          void removeInterview(sessionId);
        });
      }}
    >
      {pending ? "삭제 중" : "삭제"}
    </button>
  );
}
