"use server";

import { revalidatePath } from "next/cache";
import { BackendError } from "@/lib/backend";
import { currentOwner } from "@/lib/owner";
import { deleteResume, uploadResume } from "@/lib/resumes";

/**
 * 이력서 업로드 결과. Server Action 은 예외를 밖으로 내면 화면 전체가 에러 경계로
 * 떨어지므로, 실패를 값으로 돌려주고 폼이 문구를 그린다.
 */
export interface UploadResult {
  ok: boolean;
  /** 성공 시 분해된 문장 수 — 기대와 다르면(1문장으로 뭉침) 사용자가 다시 올릴 근거다 */
  bulletCount?: number;
  error?: string;
}

/**
 * 이력서를 올려 문장 분해·임베딩까지 만든다. **수십 초 걸린다** — 폼이 pending 을 그린다.
 *
 * `owner_key` 는 여기서만 계산한다. 익명 쿠키조차 없는 방문자는 공고 분석부터 하도록
 * 안내한다 — 쿠키 발급 경로가 그쪽에 있고, 이력서는 공고 없이는 쓸 데가 없다.
 */
export async function submitResume(text: string): Promise<UploadResult> {
  const owner = await currentOwner();
  if (!owner) {
    return { ok: false, error: "먼저 공고를 분석해 주세요. 그 뒤에 이력서를 올릴 수 있습니다." };
  }

  const trimmed = text.trim();
  if (trimmed.length < 50) {
    return { ok: false, error: "이력서 본문을 50자 이상 붙여넣어 주세요." };
  }

  try {
    const uploaded = await uploadResume(owner.key, trimmed);
    revalidatePath("/profile/resumes");
    return { ok: true, bulletCount: uploaded.bulletCount };
  } catch (err) {
    if (err instanceof BackendError) {
      return { ok: false, error: err.message };
    }
    console.error("[resumes] 업로드 실패:", err);
    return { ok: false, error: "이력서를 올리지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

/**
 * 이력서 삭제. 문장·벡터·갭 분석 결과까지 백엔드 cascade 로 함께 사라진다.
 *
 * 실패해도 예외를 밖으로 내지 않는다 (`removeSubmission` 과 같은 이유).
 */
export async function removeResume(resumeId: string): Promise<void> {
  const owner = await currentOwner();
  if (!owner) return;

  try {
    await deleteResume(owner.key, resumeId);
  } catch (err) {
    console.error("[resumes] 삭제 실패:", err);
  }
  revalidatePath("/profile/resumes");
}
