import { anonOwnerKey, readAnonSessionId, userOwnerKey } from "@/lib/owner";
import { claimAnonSubmissions } from "@/lib/store";

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
    return await claimAnonSubmissions(anonOwnerKey(anon), userOwnerKey(sessionUserId));
  } catch (err) {
    // 승계에 실패해도 로그인과 목록 조회 자체는 되어야 한다.
    console.error("[auth] 익명 기록 승계 실패:", err);
    return 0;
  }
}
