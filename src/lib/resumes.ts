import { backendFetch } from "@/lib/backend";

/**
 * 이력서 — `jobit` 백엔드 호출. 계약은 `jobit/docs/api.md` 의 "이력서".
 *
 * **원문은 여기를 지나간 뒤 다시 돌아오지 않는다.** 업로드로 올라간 본문은 백엔드가 암호화해
 * 저장하고, 어느 응답에도 원문이 없다 — 화면이 받는 것은 분해된 문장 목록뿐이다. 그래서
 * 이 레포에는 이력서 원문을 담아 둘 상태가 아예 없다.
 */

export interface ResumeSummary {
  resumeId: string;
  bulletCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface ResumeBullet {
  bulletId: string;
  company: string | null;
  period: string | null;
  text: string;
}

export interface ResumeDetail {
  resumeId: string;
  createdAt: string;
  expiresAt: string;
  bullets: ResumeBullet[];
  /** 벡터가 채워진 문장 수. 0 이면 갭 분석이 안 된다 — 재업로드 대상이다 */
  embeddedCount: number;
}

export interface UploadedResume {
  resumeId: string;
  bulletCount: number;
  expiresAt: string;
}

export async function listResumes(ownerKey: string): Promise<ResumeSummary[]> {
  const res = await backendFetch("/api/resumes", { ownerKey });
  const body = (await res.json()) as { items: ResumeSummary[] };
  return body.items;
}

export async function getResume(
  ownerKey: string,
  resumeId: string,
): Promise<ResumeDetail> {
  const res = await backendFetch(`/api/resumes/${resumeId}`, { ownerKey });
  return (await res.json()) as ResumeDetail;
}

/** LLM 분해가 뒤에 있어 수십 초 걸린다 — 호출부는 반드시 로딩 상태를 보여준다. */
export async function uploadResume(
  ownerKey: string,
  text: string,
): Promise<UploadedResume> {
  const res = await backendFetch("/api/resumes", {
    method: "POST",
    ownerKey,
    body: JSON.stringify({ text }),
  });
  return (await res.json()) as UploadedResume;
}

export async function deleteResume(
  ownerKey: string,
  resumeId: string,
): Promise<void> {
  await backendFetch(`/api/resumes/${resumeId}`, {
    method: "DELETE",
    ownerKey,
  });
}

/** 로그인 직후 익명 이력서를 계정으로 승계한다 (`claimSubmissions` 와 같은 규약). */
export async function claimResumes(
  anonOwnerKey: string,
  userOwnerKey: string,
): Promise<number> {
  const res = await backendFetch("/api/resumes/claim", {
    method: "POST",
    ownerKey: userOwnerKey,
    body: JSON.stringify({ fromOwnerKey: anonOwnerKey }),
  });
  const body = (await res.json()) as { moved: number };
  return body.moved;
}
