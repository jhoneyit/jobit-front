"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordReset, type ForgotState } from "@/app/actions/reset";

export default function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ForgotState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.sent) {
    return (
      <div className="notice" data-tone="info">
        <p style={{ margin: "0 0 8px" }}>
          <strong>{state.email}</strong> 로 재설정 링크를 보냈습니다.
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 13.5 }}>
          메일이 보이지 않으면 스팸함도 확인해주세요. 링크는 30분 뒤 만료되며 한 번만 쓸 수 있습니다.
        </p>
        <p style={{ margin: 0, fontSize: 13.5 }}>
          <Link href="/signin">로그인으로 돌아가기 →</Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="auth-form">
      {state.error && (
        <div className="notice" data-tone="error" role="alert">
          {state.error}
        </div>
      )}

      <label className="field-label">
        가입한 이메일
        <input
          type="email"
          name="email"
          required
          defaultValue={state.email ?? ""}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </label>

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{ width: "100%" }}>
      {pending ? "보내는 중…" : "재설정 링크 받기"}
    </button>
  );
}
