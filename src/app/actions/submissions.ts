"use server";

import { revalidatePath } from "next/cache";
import { currentOwner } from "@/lib/owner";
import { deleteSubmission } from "@/lib/store";

/**
 * 내 목록에서 공고 하나를 치운다.
 *
 * 지우는 건 **내 제출 이력(jd_submission)뿐**이고 job_posting 은 남긴다.
 * 공고는 여러 사용자가 공유하는 캐시 자산이라(§4.1), 한 사람이 목록에서 치웠다고
 * 지워 버리면 다른 사람의 캐시 적중까지 깨진다.
 *
 * owner_key 를 서버에서 다시 계산하므로, 남의 기록 id 를 넣어도 지워지지 않는다.
 */
export async function removeSubmission(jobPostingId: string): Promise<void> {
  const owner = await currentOwner();
  if (!owner) return;

  await deleteSubmission(owner.key, jobPostingId);
  revalidatePath("/history");
}
