import Link from "next/link";
import { auth } from "@/auth";
import Hero from "@/components/landing/Hero";
import HeroDemo from "@/components/landing/HeroDemo";
import Reveal from "@/components/landing/Reveal";

/**
 * 랜딩 페이지.
 *
 *   히어로(붙여넣기 판) → 섹션 헤더 + 카드 그리드 반복 → 푸터
 *
 * 구조는 취업 서비스 홈의 일반적인 흐름을 참고했다 —
 * 훑어보고 바로 누르는 화면이지 브랜드 필름이 아니다.
 * 다만 색·시그니처 요소는 우리 로고에서 가져온다: 스카이블루(주) + 코랄(보조).
 *
 * 히어로의 입력판은 로그인 여부로 갈리므로 여기서 세션을 읽어 넘긴다 —
 * `SessionProvider` 를 쓰지 않는 구성이라 클라이언트에서는 알 방법이 없다.
 * 이 트리는 레이아웃의 `SiteHeader` 가 이미 `auth()` 를 부르므로 원래 동적이다.
 */
export default async function HomePage() {
  const session = await auth();

  return (
    <>
      <Hero signedIn={Boolean(session?.user)} />

      {/* ── 실제 결과 ────────────────────────────────────────────── */}
      <section className="lp-sec" aria-labelledby="sample">
        <Reveal className="sec-head">
          <h2 className="sec-title" id="sample">
            <span className="sec-bar" aria-hidden="true" />
            이런 질문이 나옵니다
          </h2>
          <Link href="/analyze" className="sec-more">
            직접 만들어보기
            <Chevron />
          </Link>
        </Reveal>

        <div className="card-grid">
          {SAMPLES.map((q, i) => (
            <Reveal as="article" className="qs-card" key={q.text} delay={i * 70}>
              <div className="qs-top">
                <span className="tag">{q.tag}</span>
                <span className="difficulty" aria-label={`난이도 5점 만점에 ${q.level}점`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} data-on={n <= q.level} />
                  ))}
                </span>
              </div>
              <p className="qs-text">{q.text}</p>
              <p className="qs-from">{q.from}</p>
              <ul className="qs-points">
                {q.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── 왜 다른가 ────────────────────────────────────────────── */}
      <section className="lp-sec" aria-labelledby="why">
        <Reveal className="sec-head">
          <h2 className="sec-title" id="why">
            <span className="sec-bar" aria-hidden="true" />
            <span className="sec-key">공고마다</span> 물어보는 게 다릅니다
          </h2>
        </Reveal>

        <div className="vs">
          <Reveal className="vs-col" delay={60}>
            <p className="vs-label" data-bad="true">
              검색하면 나오는 질문
            </p>
            <ul className="vs-list vs-dim">
              <li>트랜잭션 격리 수준이 무엇인가요?</li>
              <li>REST와 GraphQL의 차이는?</li>
              <li>가비지 컬렉션에 대해 설명해보세요.</li>
            </ul>
            <p className="vs-note">
              어느 회사에나 해당됩니다. 그래서 아무 데도 해당되지 않습니다.
            </p>
          </Reveal>

          <Reveal className="vs-col vs-good" delay={130}>
            <p className="vs-label" data-good="true">
              이 공고에서 나온 질문
            </p>
            <ul className="vs-list">
              <li>결제 API에 같은 주문이 동시에 두 번 들어오면 어떻게 막으시겠어요?</li>
              <li>롤링 배포 중 결제 요청 유실을 어떻게 막나요?</li>
              <li>레거시 마이그레이션에서 롤백 기준을 어떻게 잡으셨나요?</li>
            </ul>
            <p className="vs-note">공고에 적힌 요구사항에서 직접 파생됩니다.</p>
          </Reveal>
        </div>
      </section>

      {/* ── 동작 방식 ────────────────────────────────────────────── */}
      <section className="lp-sec" aria-labelledby="how">
        <Reveal className="sec-head">
          <h2 className="sec-title" id="how">
            <span className="sec-bar" aria-hidden="true" />
            이런 순서로 만듭니다
          </h2>
        </Reveal>

        <ol className="card-grid steps-grid">
          {STEPS.map((s, i) => (
            <Reveal as="li" className="step-card" key={s.n} delay={i * 70}>
              <span className="step-n">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ── 라이브 데모 ──────────────────────────────────────────── */}
      <section className="lp-sec" aria-labelledby="live">
        <Reveal className="sec-head">
          <h2 className="sec-title" id="live">
            <span className="sec-bar" aria-hidden="true" />
            기다리지 않아도 됩니다
          </h2>
          <span className="sec-hint">완성된 질문부터 하나씩 도착합니다</span>
        </Reveal>

        <Reveal className="demo-frame" delay={60}>
          <HeroDemo />
        </Reveal>
      </section>

      {/* ── 다음 단계 ────────────────────────────────────────────── */}
      <section className="lp-sec" aria-labelledby="next">
        <Reveal className="sec-head">
          <h2 className="sec-title" id="next">
            <span className="sec-bar" aria-hidden="true" />
            곧 나옵니다 — 이력서 갭 분석
          </h2>
          <span className="sec-hint">준비 중</span>
        </Reveal>

        <Reveal className="next-card" delay={60}>
          <div>
            <p className="next-lede">
              대부분의 첨삭 도구는 공고와 무관하게 &ldquo;일반적으로 좋은 문장&rdquo;으로 고쳐
              줍니다. 같은 이력서라도 어디에 내느냐에 따라 강조할 항목이 달라집니다.
              요구사항별로 판정하고 <b>약한 항목만</b> 손봅니다. 없는 경험은 지어내지 않습니다.
            </p>
          </div>

          <ul className="gap-demo" aria-label="갭 분석 예시">
            <li>
              <span className="gap-state" data-s="met">
                충족
              </span>
              <span>Spring Boot 3년+</span>
            </li>
            <li>
              <span className="gap-state" data-s="weak">
                약함
              </span>
              <span>
                대용량 트래픽 경험
                <em>언급은 있으나 수치가 없습니다</em>
              </span>
            </li>
            <li>
              <span className="gap-state" data-s="missing">
                없음
              </span>
              <span>
                Kubernetes 운영
                <em>면접에서 물어볼 가능성이 높습니다</em>
              </span>
            </li>
          </ul>
        </Reveal>
      </section>

      {/* ── 마무리 ───────────────────────────────────────────────── */}
      <section className="lp-sec">
        <Reveal className="cta-card">
          <h2>공고 하나만 붙여넣어 보세요</h2>
          <p>가입하지 않아도 됩니다. 마음에 들면 그때 저장하세요.</p>
          <Link href="/analyze" className="btn-primary btn-lg">
            공고 분석 시작하기
            <Chevron />
          </Link>
        </Reveal>
      </section>
    </>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 5l5 5-5 5" />
    </svg>
  );
}

const SAMPLES = [
  {
    tag: "설계",
    level: 4,
    text: "결제 API에서 같은 주문 요청이 동시에 두 번 들어오면 어떻게 막으시겠어요?",
    from: "대용량 트래픽 환경에서의 결제 API 개발 경험",
    points: ["멱등키 설계를 먼저 언급", "본인 경험의 구체적 수치를 함께 제시"],
  },
  {
    tag: "스택",
    level: 3,
    text: "롤링 배포 중 결제 요청이 유실되지 않게 하려면 무엇을 설정해야 하나요?",
    from: "Kubernetes 운영 경험",
    points: ["graceful shutdown 언급", "readiness probe 와의 관계 설명"],
  },
  {
    tag: "경험",
    level: 3,
    text: "레거시 마이그레이션에서 롤백 기준을 어떻게 잡으셨나요?",
    from: "레거시 시스템 마이그레이션",
    points: ["되돌릴 판단 지표를 숫자로", "실제로 롤백한 경험이 있다면 우선"],
  },
] as const;

const STEPS = [
  {
    n: "1",
    t: "요구사항으로 분해",
    d: "자격요건·우대사항·담당업무를 한 줄에 한 가지씩 쪼갭니다. 판정할 수 없는 수사는 버립니다.",
  },
  {
    n: "2",
    t: "요구사항마다 질문 생성",
    d: "이 공고의 스택·도메인·연차에 맞춰, 용어 정의가 아니라 실제로 부딪히는 상황을 냅니다.",
  },
  {
    n: "3",
    t: "완성되는 대로 전달",
    d: "전부 만들어질 때까지 기다리지 않습니다. 첫 질문은 대개 1~2초 안에 화면에 뜹니다.",
  },
] as const;
