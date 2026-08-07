"use server";

import { revalidatePath } from "next/cache";
import { deleteInterview } from "@/lib/interviews";
import { currentOwner } from "@/lib/owner";

/**
 * 내 면접 기록 하나를 지운다.
 *
 * 지우는 건 **연습 기록(세션과 답변)뿐**이고 질문·공고는 남긴다. 둘 다 공유 자산이라
 * 한 사람이 자기 기록을 치웠다고 지우면 다른 사람의 캐시 적중까지 깨진다.
 * 그 규칙은 백엔드가 지킨다.
 *
 * owner_key 를 서버에서 다시 계산하므로, 남의 기록 id 를 넣어도 지워지지 않는다 —
 * 백엔드가 owner_key 를 조회 조건에 넣고 404 를 준다.
 *
 * **실패해도 예외를 밖으로 내지 않는다.** Server Action 이라 예외가 나면 화면 전체가 에러
 * 경계로 떨어진다. 한 줄 지우기가 실패했다고 기록 전체를 못 보게 되는 건 과하다
 * (`removeSubmission` 과 같은 판단).
 */
export async function removeInterview(sessionId: string): Promise<void> {
  const owner = await currentOwner();
  if (!owner) return;

  try {
    await deleteInterview(owner.key, sessionId);
  } catch (err) {
    console.error("[interviews] 삭제 실패:", err);
  }
  revalidatePath("/profile/interviews");
}
