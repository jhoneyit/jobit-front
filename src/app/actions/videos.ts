"use server";

import { revalidatePath } from "next/cache";
import { currentOwner } from "@/lib/owner";
import { deleteVideoSubmission } from "@/lib/videos";

/**
 * 내 목록에서 요약 하나를 치운다. 지우는 건 내 이력뿐이고 요약(전역 캐시)은 남는다 —
 * `removeSubmission` 과 같은 규약이고, 실패해도 예외를 밖으로 내지 않는 것도 같다.
 */
export async function removeVideoSubmission(summaryId: string): Promise<void> {
  const owner = await currentOwner();
  if (!owner) return;

  try {
    await deleteVideoSubmission(owner.key, summaryId);
  } catch (err) {
    console.error("[videos] 삭제 실패:", err);
  }
  revalidatePath("/videos");
}
