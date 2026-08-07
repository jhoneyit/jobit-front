"use server";

import { revalidatePath } from "next/cache";
import { currentOwner } from "@/lib/owner";
import { deleteSubmission } from "@/lib/submissions";

/**
 * 내 목록에서 공고 하나를 치운다.
 *
 * 지우는 건 **내 제출 이력(jd_submission)뿐**이고 job_posting 은 남긴다.
 * 공고는 여러 사용자가 공유하는 캐시 자산이라(§4.1), 한 사람이 목록에서 치웠다고
 * 지워 버리면 다른 사람의 캐시 적중까지 깨진다. 그 규칙은 이제 백엔드가 지킨다.
 *
 * owner_key 를 서버에서 다시 계산하므로, 남의 기록 id 를 넣어도 지워지지 않는다 —
 * 백엔드가 owner_key 를 조회 조건에 넣고 404 를 준다.
 *
 * **삭제에 실패해도 예외를 밖으로 내지 않는다.** 이건 Server Action 이라 예외가 나면 화면 전체가
 * 에러 경계로 떨어진다. 목록에서 한 줄 지우기가 실패했다고 기록 전체를 못 보게 되는 건 과하다.
 */
export async function removeSubmission(submissionId: string): Promise<void> {
  const owner = await currentOwner();
  if (!owner) return;

  try {
    await deleteSubmission(owner.key, submissionId);
  } catch (err) {
    console.error("[submissions] 삭제 실패:", err);
  }
  revalidatePath("/profile/history");
}
