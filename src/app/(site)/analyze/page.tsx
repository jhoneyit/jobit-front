import type { Metadata } from "next";
import Link from "next/link";
import JdInputForm from "@/components/JdInputForm";
import StackRanking from "@/components/StackRanking";

// 순위가 요청마다 새로 집계돼야 "실시간"이 된다. 정적 최적화되면 빌드 시점에 굳는다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "공고 분석",
  description:
    "채용공고를 붙여넣으면 그 공고의 자격요건에서 뽑아낸 예상 면접 질문과 답변 뼈대를 만들어 드립니다.",
};

export default function AnalyzePage() {
  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 26, letterSpacing: "-0.025em" }}>공고 분석</h1>
        <p>
          채용공고 본문을 통째로 붙여넣으세요. 자격요건·우대사항·담당업무가 모두 들어 있을수록
          질문이 정확해집니다.
        </p>
      </section>

      <JdInputForm />

      <StackRanking />

      <section className="section">
        <div className="section-head">
          <h2>붙여넣기 전에</h2>
        </div>
        <ul className="tips">
          <li>
            <b>본문 전체를 넣으세요.</b> 자격요건만 넣으면 담당업무에서 나올 질문이 빠집니다.
          </li>
          <li>
            <b>회사 소개·복지는 있어도 괜찮습니다.</b> 판정할 수 없는 문장은 알아서 걸러냅니다.
          </li>
          <li>
            <b>웹에서 드래그해 복사한 평문이 가장 좋습니다.</b> HTML 소스를 그대로 넣으면 태그가
            토큰을 잡아먹고, 같은 공고인데도 캐시가 빗나갑니다.
          </li>
        </ul>
      </section>

      <p className="footnote">
        붙여넣은 공고는 질문 생성에 쓰이고, 같은 공고를 다시 넣는 사람을 위해 캐시됩니다.
        만든 질문은 <Link href="/history">내 기록</Link>에서 다시 열어볼 수 있습니다.
        이력서 같은 개인 문서는 아직 받지 않습니다.
      </p>
    </>
  );
}
