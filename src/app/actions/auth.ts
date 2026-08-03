"use server";

import { signIn, signOut } from "@/auth";

/**
 * 로그인 시작. 성공하면 GitHub 로 리디렉트된다.
 *
 * 익명 기록 승계는 여기서 하지 않는다 — OAuth 리디렉트 체인 중에는 우리 익명 쿠키를
 * 신뢰성 있게 읽기 어렵고, 승계가 실패했다고 로그인까지 막을 이유가 없다.
 * 대신 /history 진입 시 `lib/claim.ts` 가 한 번 처리한다.
 */
export async function signInWithGitHub(formData: FormData) {
  const callbackUrl = (formData.get("callbackUrl") as string) || "/history";
  await signIn("github", { redirectTo: callbackUrl });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
