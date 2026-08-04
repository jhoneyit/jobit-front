import { backendFetch } from "@/lib/backend";

/**
 * 지금까지 들어온 공고의 기술 스택 순위.
 *
 * <p>서버 컴포넌트다 — 요청마다 새로 집계하므로 클라이언트 JS 가 필요 없다.
 *
 * <p><b>DB 를 직접 읽지 않고 백엔드를 부른다.</b> 2026-08-04 이관으로 도메인 조회는 `jobit` 이
 * 갖기로 했고, 화면 하나 때문에 그 경계를 뚫으면 나중에 이관할 코드가 늘어난다.
 *
 * <p><b>백엔드가 죽어도 이 섹션만 사라진다.</b> 이 페이지의 본체는 공고 입력 폼이고 순위는
 * 곁들이라, 집계가 안 된다고 입력까지 막으면 앞뒤가 바뀐다.
 */
interface StackRanking {
  totalPostings: number;
  items: { name: string; postings: number }[];
}

export default async function StackRanking() {
  let data: StackRanking;
  try {
    const res = await backendFetch("/api/stats/stacks?limit=8");
    data = (await res.json()) as StackRanking;
  } catch (err) {
    console.error("[stats] 스택 순위를 불러오지 못했습니다:", err);
    return null;
  }

  if (data.items.length === 0) {
    return null;
  }

  // 1위를 100%로 두고 나머지를 상대 비교한다. 전체 공고 수로 나누면 표본이 적을 때
  // 막대가 전부 짧아 순위가 눈에 안 들어온다.
  const top = data.items[0].postings;

  return (
    <section className="section">
      <div className="section-head">
        <h2>지금 많이 들어온 스택</h2>
        <span className="hint">공고 {data.totalPostings.toLocaleString("ko-KR")}건 기준</span>
      </div>

      <ol className="rank">
        {data.items.map((item, i) => (
          <li key={item.name} className="rank-row">
            <span className="rank-no" data-top={i < 3 || undefined}>
              {i + 1}
            </span>
            <span className="rank-name">{item.name}</span>
            <span className="rank-track" aria-hidden="true">
              <span
                className="rank-fill"
                style={{ width: `${Math.max(6, (item.postings / top) * 100)}%` }}
              />
            </span>
            <span className="rank-count">{item.postings}건</span>
          </li>
        ))}
      </ol>

      <p className="rank-note">
        붙여넣은 공고에서 뽑아낸 기술 스택을 센 것입니다. 공고가 쌓일수록 순위가 정확해집니다.
      </p>
    </section>
  );
}
