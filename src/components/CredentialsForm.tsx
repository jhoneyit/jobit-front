"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions/credentials";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export default function CredentialsForm({
  mode,
  action,
  callbackUrl,
}: {
  mode: "signin" | "signup";
  action: Action;
  callbackUrl: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const isSignUp = mode === "signup";

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      {state.error && (
        <div className="notice" data-tone="error" role="alert">
          {state.error}
        </div>
      )}

      {isSignUp && (
        <label className="field-label">
          이름 <span className="optional">(선택)</span>
          <input
            type="text"
            name="name"
            defaultValue={state.name ?? ""}
            maxLength={50}
            autoComplete="name"
            placeholder="화면에 표시될 이름"
          />
        </label>
      )}

      <label className="field-label">
        이메일
        <input
          type="email"
          name="email"
          required
          defaultValue={state.email ?? ""}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </label>

      <label className="field-label">
        비밀번호
        <input
          type="password"
          name="password"
          required
          minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />
        {isSignUp && (
          <span className="hint-text">
            {MIN_PASSWORD_LENGTH}자 이상. 길수록 안전합니다 — 특수문자 조합보다 길이가 중요합니다.
          </span>
        )}
      </label>

      {isSignUp && (
        <label className="field-label">
          비밀번호 확인
          <input
            type="password"
            name="passwordConfirm"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
        </label>
      )}

      <SubmitButton label={isSignUp ? "가입하기" : "로그인"} />
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ width: "100%" }}>
      {pending ? "처리 중…" : label}
    </button>
  );
}
