"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { anonOwnerKey, userOwnerKey } from "@/lib/owner";
import { saveProfile } from "@/lib/profile/store";
import { MAX_STACK_LENGTH, MAX_STACKS } from "@/lib/profile/types";
import { getOrCreateSessionId } from "@/lib/rate-limit";

export interface ProfileState {
  error?: string;
  success?: string;
}

/** 공고에 적히는 값이 아니라 사람의 경력이다. 상한은 데이터 오염 방어이지 의미상 제한이 아니다. */
const MAX_YEARS = 70;

/**
 * 내 정보 저장.
 *
 * <b>owner_key 를 인자로 받지 않는다.</b> Server Action 은 공개 엔드포인트라, 소유자 키를
 * 받으면 남의 키를 넣어 남의 프로필을 덮어쓸 수 있다. 세션·쿠키에서 직접 읽는다
 * (`claim.ts` 가 같은 이유로 userId 를 인자로 받지 않는 것과 같은 규칙).
 *
 * 비로그인도 저장할 수 있다. `/profile/history` 가 익명 기록을 보여주는 것과 같은 결이고,
 * 로그인하면 `claimAnonProfile` 이 계정으로 옮긴다.
 */
export async function saveMyProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  const userId = session?.user?.id;

  // 비로그인이면 이 시점에 익명 쿠키를 발급한다 — 저장할 게 생겼으니 소유자가 필요하다.
  const ownerKey = userId ? userOwnerKey(userId) : anonOwnerKey(await getOrCreateSessionId());

  const rawYears = String(formData.get("yearsOfExp") ?? "").trim();
  let yearsOfExp: number | null = null;
  if (rawYears !== "") {
    const parsedYears = Number(rawYears);
    if (!Number.isInteger(parsedYears) || parsedYears < 0 || parsedYears > MAX_YEARS) {
      return { error: `경력은 0~${MAX_YEARS} 사이의 정수로 입력해주세요.` };
    }
    yearsOfExp = parsedYears;
  }

  const stacks = normalizeStacks(formData.getAll("stacks").map(String));
  if (stacks.length > MAX_STACKS) {
    return { error: `보유 스택은 ${MAX_STACKS}개까지 넣을 수 있습니다.` };
  }
  if (stacks.some((s) => s.length > MAX_STACK_LENGTH)) {
    return { error: `스택 이름은 ${MAX_STACK_LENGTH}자를 넘을 수 없습니다.` };
  }

  try {
    await saveProfile(ownerKey, { yearsOfExp, stacks });
  } catch (err) {
    console.error("[profile] 저장 실패:", err);
    return { error: "저장에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  revalidatePath("/profile/me");
  return { success: "저장했습니다. 결과 화면에서 내 경력 기준으로 표시됩니다." };
}

/**
 * 공백 정리 + 중복 제거.
 *
 * 대소문자는 <b>죽이지 않는다.</b> 사용자가 적은 표기를 화면에 그대로 되돌려 줘야 하고,
 * 매칭 쪽(`match.ts`)이 어차피 정규화해서 비교한다. 여기서 소문자로 뭉개면
 * 화면에 "postgresql" 이라고 보이게 된다.
 */
function normalizeStacks(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    const name = value.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
