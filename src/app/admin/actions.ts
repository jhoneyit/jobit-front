"use server";

import { redirect } from "next/navigation";
import {
  adminDisabled,
  checkCredentials,
  endAdminSession,
  startAdminSession,
} from "@/lib/admin/auth";

/**
 * 관리자 로그인.
 *
 * 실패 사유를 구분해 주지 않는다 — "아이디가 없습니다"와 "비밀번호가 틀렸습니다"를 나누면
 * 어떤 아이디가 존재하는지 알려주는 셈이다. 계정이 하나뿐이라 실익도 없다.
 */
export async function adminLogin(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  if (adminDisabled()) {
    return { error: "운영 환경에서는 ADMIN_PASSWORD 를 설정해야 관리자 콘솔이 열립니다." };
  }

  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!checkCredentials(user, password)) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  await startAdminSession();
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}
