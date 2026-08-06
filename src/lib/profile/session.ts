import { claimAnonymousProfile } from "@/lib/claim";
import { currentOwner, type Owner } from "@/lib/owner";
import { getProfile } from "@/lib/profile/store";
import type { Profile } from "@/lib/profile/types";

/**
 * 현재 요청의 소유자 + 내 정보를 한 번에 읽는다.
 *
 * <b>읽기 경로에 승계를 붙여 둔 이유.</b> 로그인 직후 사용자가 어느 화면으로 가는지 정해져
 * 있지 않다 — `/profile/me` 일 수도, 곧장 결과 페이지일 수도 있다. 승계를 특정 화면에만
 * 걸어 두면 다른 경로로 들어온 사람은 방금 채운 정보가 사라진 것처럼 보인다.
 *
 * 비용은 바운드돼 있다: 익명 쿠키가 남아 있는 로그인 사용자에게만 SELECT 가 한 번 더 나가고,
 * 한 번 옮기고 나면 익명 행이 지워지므로 그 다음부터는 빈 SELECT 하나로 끝난다.
 */
export async function readMyProfile(): Promise<{ owner: Owner | null; profile: Profile | null }> {
  const owner = await currentOwner();
  if (!owner) return { owner: null, profile: null };

  if (owner.isLoggedIn && owner.userId) {
    await claimAnonymousProfile(owner.userId);
  }

  return { owner, profile: await getProfile(owner.key) };
}
