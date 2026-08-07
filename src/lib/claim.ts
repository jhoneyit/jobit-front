import { anonOwnerKey, readAnonSessionId, userOwnerKey } from "@/lib/owner";
import { claimAnonProfile } from "@/lib/profile/store";
import { claimSubmissions } from "@/lib/submissions";

/**
 * 로그인 전에 익명으로 쌓아 둔 제출 이력을 계정으로 옮긴다.
 *
 * 이게 없으면 "질문 만들어 보고 마음에 들어서 로그인했더니 방금 만든 게 사라진" 상태가 된다.
 *
 * **의도적으로 Server Action("use server")이 아니다.**
 * Server Action 으로 만들면 userId 를 인자로 받는 공개 엔드포인트가 생기고,
 * 남의 user_id 를 넣어 자기 익명 기록을 그 계정으로 밀어 넣을 수 있다.
 * 그래서 평범한 서버 함수로 두고, userId 는 인자로 받지 않고 세션에서 직접 읽는다.
 */
export async function claimAnonymousHistory(sessionUserId: string): Promise<number> {
  const anon = await readAnonSessionId();
  if (!anon) return 0;

  try {
    return await claimSubmissions(anonOwnerKey(anon), userOwnerKey(sessionUserId));
  } catch (err) {
    // 승계에 실패해도 로그인과 목록 조회 자체는 되어야 한다.
    console.error("[auth] 익명 기록 승계 실패:", err);
    return 0;
  }
}

/**
 * 로그인 전에 익명으로 채워 둔 내 정보를 계정으로 옮긴다.
 *
 * 제출 이력과 <b>따로 도는 이유</b>: 이력 승계는 `/profile/history` 진입 때 한 번 일어나는데,
 * 프로필은 `/profile/me` 로 바로 들어온 사람도 옮겨져야 한다. 둘을 한 함수로 묶으면
 * 어느 쪽 화면을 먼저 여느냐에 따라 결과가 달라진다.
 *
 * 이력 승계와 같은 이유로 Server Action 이 아니고, userId 를 인자로 받지 않는다.
 *
 * @returns 실제로 옮겼으면 true (계정에 이미 프로필이 있었으면 false)
 */
export async function claimAnonymousProfile(sessionUserId: string): Promise<boolean> {
  const anon = await readAnonSessionId();
  if (!anon) return false;

  try {
    return await claimAnonProfile(anonOwnerKey(anon), userOwnerKey(sessionUserId));
  } catch (err) {
    console.error("[auth] 익명 프로필 승계 실패:", err);
    return false;
  }
}
