"use client";

import { useActionState } from "react";
import { adminLogin } from "@/app/admin/actions";

export default function AdminLoginForm({ defaultUser }: { defaultUser: string }) {
  const [state, action, pending] = useActionState(adminLogin, {});

  return (
    <form action={action} className="adm-login-form">
      <label className="adm-field">
        <span>아이디</span>
        <input name="user" defaultValue={defaultUser} autoComplete="username" required />
      </label>

      <label className="adm-field">
        <span>비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
        />
      </label>

      {state?.error && (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="adm-btn adm-btn-primary" disabled={pending}>
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
