"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitResume } from "@/app/actions/resumes";

/**
 * 이력서 업로드 폼.
 *
 * **파일 업로드가 아니다** — 본문 텍스트를 붙여넣는다 (백엔드 계약). PDF 파서·업로드 상한을
 * 두지 않는 대신, 붙여넣기는 브라우저가 이미 잘한다.
 *
 * **분해가 수십 초 걸린다.** pending 동안 버튼과 문구가 그 사실을 말해야 한다 — 아무 표시
 * 없이 멈춘 것처럼 보이면 사용자는 다시 눌러 한도만 태운다.
 */
export default function ResumeUploadForm({ hasOwner }: { hasOwner: boolean }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, start] = useTransition();

  if (!hasOwner) {
    return (
      <div className="notice" data-tone="info">
        먼저 <Link href="/analyze">공고를 분석</Link>해 주세요. 그 뒤에 이력서를 올려 갭
        분석을 돌릴 수 있습니다.
      </div>
    );
  }

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setDone(null);
        start(async () => {
          const result = await submitResume(text);
          if (result.ok) {
            setText("");
            setDone(result.bulletCount ?? 0);
          } else {
            setError(result.error ?? "이력서를 올리지 못했습니다.");
          }
        });
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={"이력서 본문을 붙여넣어 주세요.\n\n경력·프로젝트 단위로 한 일이 드러나면 문장 분해가 정확해집니다."}
        disabled={pending}
        aria-label="이력서 본문"
        style={{ width: "100%", resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <button type="submit" className="cta" disabled={pending || text.trim().length < 50}>
          {pending ? "분해 중… (수십 초 걸립니다)" : "올리고 문장 분해하기"}
        </button>
        {!pending && text.trim().length > 0 && text.trim().length < 50 && (
          <span className="hint">50자 이상 붙여넣어 주세요</span>
        )}
      </div>

      {error && (
        <div className="notice" data-tone="warn" style={{ marginTop: 12 }} role="alert">
          {error}
        </div>
      )}
      {done != null && (
        <div className="notice" data-tone="info" style={{ marginTop: 12 }} role="status">
          문장 {done}개로 분해했습니다.
          {done <= 1 && (
            <>
              {" "}
              문장이 너무 적게 나뉘었다면 경력·프로젝트 단위로 줄바꿈해 다시 올려 보세요.
            </>
          )}
        </div>
      )}
    </form>
  );
}
