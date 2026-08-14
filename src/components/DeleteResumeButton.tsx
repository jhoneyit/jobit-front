"use client";

import { useTransition } from "react";
import { removeResume } from "@/app/actions/resumes";

export default function DeleteResumeButton({
  resumeId,
  label,
}: {
  resumeId: string;
  label: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className="row-delete"
      disabled={pending}
      aria-label={`${label} 삭제`}
      onClick={() => {
        // 갭 분석 결과까지 함께 사라진다는 것을 지우기 전에 말한다 — cascade 는 되돌릴 수 없다.
        if (!confirm("이 이력서를 지울까요? 분해된 문장과 갭 분석 결과도 함께 사라집니다.")) return;
        start(() => {
          void removeResume(resumeId);
        });
      }}
    >
      {pending ? "삭제 중" : "삭제"}
    </button>
  );
}
