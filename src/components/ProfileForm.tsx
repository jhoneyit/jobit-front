"use client";

import { useActionState, useState, type KeyboardEvent } from "react";
import { useFormStatus } from "react-dom";
import { saveMyProfile, type ProfileState } from "@/app/actions/profile";
import { MAX_STACKS, type Profile } from "@/lib/profile/types";

/**
 * 내 정보 입력.
 *
 * 스택은 자유 입력 태그다. 목록에서 고르게 하면 목록에 없는 기술을 쓰는 사람이 막히고,
 * 목록을 관리하는 일이 새로 생긴다. 대신 <b>추천 칩</b>으로 타이핑을 줄인다 —
 * 이 사람이 이미 넣어 본 공고에서 뽑은 값이라 적중률이 높다.
 *
 * 태그는 hidden input 으로 제출한다. Server Action 이 FormData 를 받으므로 상태를 따로
 * 직렬화할 필요가 없고, JS 가 죽어도 이미 담긴 값은 그대로 전송된다.
 */
export default function ProfileForm({
  initial,
  suggestions,
}: {
  initial: Profile;
  suggestions: string[];
}) {
  const [state, formAction] = useActionState<ProfileState, FormData>(saveMyProfile, {});
  const [stacks, setStacks] = useState<string[]>(initial.stacks);
  const [draft, setDraft] = useState("");

  const full = stacks.length >= MAX_STACKS;
  // 이미 담은 것은 추천에서 뺀다. 눌러도 아무 일이 없으면 고장으로 보인다.
  const remaining = suggestions.filter(
    (s) => !stacks.some((existing) => existing.toLowerCase() === s.toLowerCase()),
  );

  function add(raw: string) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name || full) return;
    if (stacks.some((s) => s.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    setStacks((prev) => [...prev, name]);
    setDraft("");
  }

  function onDraftKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Enter 로 폼이 제출되지 않게 막는다 — 태그 하나 넣으려다 저장이 돼 버리면 안 된다.
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
      return;
    }
    // 빈 칸에서 백스페이스는 마지막 태그를 지운다 (태그 입력의 관용).
    if (e.key === "Backspace" && draft === "" && stacks.length > 0) {
      setStacks((prev) => prev.slice(0, -1));
    }
  }

  return (
    <form action={formAction} className="auth-form" style={{ maxWidth: 520 }}>
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

      <label className="field-label">
        경력
        <span className="years-input">
          <input
            type="number"
            name="yearsOfExp"
            min={0}
            max={70}
            step={1}
            defaultValue={initial.yearsOfExp ?? ""}
            placeholder="예: 5"
            inputMode="numeric"
          />
          <span aria-hidden="true">년차</span>
        </span>
        <span className="hint-text">
          비워 두면 난이도 안내를 하지 않습니다. 신입이면 0을 넣어주세요 — 빈 칸과 다르게 봅니다.
        </span>
      </label>

      <div className="field-label">
        <span id="stacks-label">보유 스택</span>

        {stacks.length > 0 && (
          <ul className="stack-tags" aria-labelledby="stacks-label">
            {stacks.map((s) => (
              <li className="stack-tag" key={s.toLowerCase()}>
                {/* 값 자체는 hidden 으로 나간다 — 버튼 label 과 전송 값을 분리해 둔다 */}
                <input type="hidden" name="stacks" value={s} />
                <span>{s}</span>
                <button
                  type="button"
                  className="stack-tag-remove"
                  aria-label={`${s} 빼기`}
                  onClick={() => setStacks((prev) => prev.filter((v) => v !== s))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onDraftKeyDown}
          onBlur={() => add(draft)}
          disabled={full}
          placeholder={full ? `${MAX_STACKS}개까지 넣을 수 있습니다` : "Java, Spring Boot … Enter 로 추가"}
          aria-describedby="stacks-hint"
        />
        <span className="hint-text" id="stacks-hint">
          공고가 절대 알 수 없는 정보입니다. 표기는 편한 대로 적으세요 —
          <code>k8s</code>와 <code>Kubernetes</code>는 같은 것으로 봅니다.
        </span>

        {remaining.length > 0 && !full && (
          <div className="suggest">
            <span className="suggest-label">내가 넣은 공고에 나온 스택</span>
            <div className="chips">
              {remaining.map((s) => (
                <button type="button" className="chip chip-add" key={s} onClick={() => add(s)}>
                  {s} <span aria-hidden="true">+</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "저장 중…" : "저장"}
    </button>
  );
}
