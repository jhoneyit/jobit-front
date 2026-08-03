import type { Question, QuestionCategory, Requirement } from "@/lib/types";

const CATEGORY_LABEL: Record<QuestionCategory, string> = {
  CS: "CS 기초",
  STACK: "스택",
  EXPERIENCE: "경험",
  DESIGN: "설계",
  CULTURE: "협업",
};

export default function QuestionCard({
  question,
  index,
  requirement,
}: {
  question: Question;
  index: number;
  requirement: Requirement | null;
}) {
  return (
    <article className="q-card">
      <div className="q-top">
        <span className="q-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="chip">{CATEGORY_LABEL[question.category]}</span>
        <span
          className="difficulty"
          title={`난이도 ${question.difficulty}/5`}
          aria-label={`난이도 ${question.difficulty}점 만점에 5점`}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <i key={n} data-on={n <= question.difficulty} />
          ))}
        </span>
      </div>

      <h3 className="q-text">{question.text}</h3>

      {requirement && <p className="q-from">← {requirement.text}</p>}

      {question.answerOutline.length > 0 && (
        <div className="q-block">
          <h4>답변에서 짚어야 할 것</h4>
          <ul>
            {question.answerOutline.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {question.followups.length > 0 && (
        <div className="q-block">
          <h4>이어질 꼬리질문</h4>
          <ul>
            {question.followups.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
