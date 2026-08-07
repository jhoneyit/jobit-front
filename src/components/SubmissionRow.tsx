import Link from "next/link";
import DeleteSubmissionButton from "@/components/DeleteSubmissionButton";
import type { SubmissionListItem } from "@/lib/types";

export default function SubmissionRow({ item }: { item: SubmissionListItem }) {
  const heading =
    [item.company, item.title].filter(Boolean).join(" · ") || "제목 없는 공고";

  return (
    <li className="sub-item">
      <div className="sub-main">
        <Link href={`/result/${item.jobPostingId}`} className="sub-title">
          {heading}
        </Link>

        {item.domain && <p className="sub-domain">{item.domain}</p>}

        {item.stack.length > 0 && (
          <div className="chips" style={{ marginTop: 8 }}>
            {item.stack.slice(0, 6).map((s) => (
              <span className="chip" key={s}>
                {s}
              </span>
            ))}
            {item.stack.length > 6 && (
              <span className="chip">+{item.stack.length - 6}</span>
            )}
          </div>
        )}

        <p className="sub-meta">
          <span>요구사항 {item.requirementCount}개</span>
          <span aria-hidden="true">·</span>
          <span>
            {item.questionCount > 0 ? (
              `질문 ${item.questionCount}개`
            ) : (
              <em style={{ fontStyle: "normal", color: "var(--warn)" }}>질문 미생성</em>
            )}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
        </p>
      </div>

      <DeleteSubmissionButton submissionId={item.submissionId} label={heading} />
    </li>
  );
}

function formatDate(iso: string): string {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;

  return then.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
