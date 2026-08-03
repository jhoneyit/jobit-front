"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, type AccountState } from "@/app/actions/account";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export default function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction] = useActionState<AccountState, FormData>(changePassword, {});

  return (
    <form action={formAction} className="auth-form" style={{ maxWidth: 380 }}>
      {state.error && (
        <div className="notice" data-tone="error" role="alert">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="notice" data-tone="ok" role="status">
          {state.success}
        </div>
      )}

      {hasPassword && (
        <label className="field-label">
          현재 비밀번호
          <input type="password" name="currentPassword" required autoComplete="current-password" />
        </label>
      )}

      <label className="field-label">
        새 비밀번호
        <input
          type="password"
          name="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
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

      <Submit label={hasPassword ? "비밀번호 변경" : "비밀번호 설정"} />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "처리 중…" : label}
    </button>
  );
}
