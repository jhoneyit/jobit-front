import type { Metadata } from "next";
import Link from "next/link";
import ProfileForm from "@/components/ProfileForm";
import { readMyProfile } from "@/lib/profile/session";
import { suggestStacks } from "@/lib/profile/store";
import { EMPTY_PROFILE } from "@/lib/profile/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 정보",
  robots: { index: false, follow: false },
};

/**
 * 내 정보 입력.
 *
 * <b>로그인을 요구하지 않는다.</b> `/profile/history` 가 익명 기록을 보여주는 것과 같은 결이고,
 * 소유자 식별은 `owner_key` 하나로 끝나므로 분기가 필요 없다. 로그인하면 `claim.ts` 가
 * 익명으로 채워 둔 값을 계정으로 옮긴다.
 *
 * 아직 쿠키조차 없는 첫 방문자는 `currentOwner()` 가 null 이다. 그때는 빈 폼을 보여주고,
 * 저장하는 순간 Server Action 이 쿠키를 발급한다 — 읽기만 하는 화면에서 쿠키를 심지 않는다.
 */
export default async function ProfileMePage() {
  // 로그인 직전에 익명으로 채워 둔 값이 있으면 여기서 계정으로 넘어온다.
  const { owner, profile } = await readMyProfile();
  const suggestions = owner ? await suggestStacks(owner.key) : [];

  return (
    <>
      <section className="hero">
        <h1 style={{ fontSize: 24 }}>내 정보</h1>
        <p>
          공고에서는 읽어낼 수 없는 것만 받습니다 — 공고에 적힌 건 &ldquo;회사가 원하는 것&rdquo;이고,
          여기 적는 건 &ldquo;내가 가진 것&rdquo;입니다. 둘을 맞대어 먼저 준비할 질문을 골라 드립니다.
        </p>
      </section>

      <ProfileForm initial={profile ?? EMPTY_PROFILE} suggestions={suggestions} />

      {owner && !owner.isLoggedIn && (
        <div className="notice" data-tone="warn" role="status" style={{ marginTop: 20 }}>
          아직 로그인하지 않으셨습니다. 브라우저 데이터를 지우면 이 정보도 사라집니다.{" "}
          <Link href="/signin?callbackUrl=/profile/me">로그인하고 계정에 저장하기 →</Link>
        </div>
      )}

      <section className="section">
        <div className="section-head">
          <h2>어디에 쓰이나요</h2>
        </div>
        <ul className="tips">
          <li>
            <b>질문을 다시 만들지 않습니다.</b> 이미 만들어진 질문을 정렬하고 표시만 바꿉니다 —
            그래서 정보를 고쳐도 기다릴 필요가 없고, 추가 비용도 들지 않습니다.
          </li>
          <li>
            <b>요구사항에 배지가 붙습니다.</b> 내 보유 스택과 겹치는 항목과 그렇지 않은 항목을
            갈라 보여 주고, 겹치지 않는 쪽에서 나온 질문을 위로 올립니다.
          </li>
          <li>
            <b>이력서 갭 분석과는 다릅니다.</b> 여기서는 스택 이름이 겹치는지만 봅니다.
            문장 단위의 충족 판정은 이력서를 받는 3단계에서 합니다.
          </li>
        </ul>
      </section>
    </>
  );
}
