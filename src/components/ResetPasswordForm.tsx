"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitNewPassword, type ResetState } from "@/app/actions/reset";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export default function ResetPasswordForm({
  token,
  email,
}: {
  token: string;
  email: string | null;
}) {
  const [state, formAction] = useActionState<ResetState, FormData>(submitNewPassword, {});

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="token" value={token} />
      {email && <input type="hidden" name="email" value={email} />}

      {state.error && (
        <div className="notice" data-tone="error" role="alert">
          {state.error}
        </div>
      )}

      {email && (
        <p className="auth-lede" style={{ margin: 0 }}>
          <strong>{email}</strong> 의 새 비밀번호를 설정합니다.
        </p>
      )}

      <label className="field-label">
        새 비밀번호
        <input
          type="password"
          name="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          autoFocus
        />
        <span className="hint-text">
          {MIN_PASSWORD_LENGTH}자 이상. 길수록 안전합니다 — 특수문자 조합보다 길이가 중요합니다.
        </span>
      </label>

      <label className="field-label">
        새 비밀번호 확인
        <input
          type="password"
          name="passwordConfirm"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
        />
      </label>

      <Submit />

      <p className="hint-text" style={{ textAlign: "center" }}>
        재설정하면 기존에 로그인된 모든 기기에서 로그아웃됩니다.
      </p>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ width: "100%" }}>
      {pending ? "변경 중…" : "비밀번호 변경"}
    </button>
  );
}
