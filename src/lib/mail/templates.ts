import type { Mail } from "@/lib/mail";

const BRAND = "jobit";

function shell(title: string, body: string, cta?: { href: string; label: string }): string {
  return `<!doctype html><html lang="ko"><body style="margin:0;padding:24px;background:#f7f7f8;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#18181b;line-height:1.65;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:10px;padding:28px;">
    <p style="margin:0 0 20px;font-weight:700;font-size:15px;">${BRAND}</p>
    <h1 style="margin:0 0 14px;font-size:19px;letter-spacing:-0.01em;">${title}</h1>
    ${body}
    ${
      cta
        ? `<p style="margin:24px 0;"><a href="${cta.href}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px;">${cta.label}</a></p>
    <p style="margin:0 0 4px;font-size:12px;color:#71717a;">버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여넣으세요.</p>
    <p style="margin:0;font-size:12px;color:#71717a;word-break:break-all;">${cta.href}</p>`
        : ""
    }
  </div>
</body></html>`;
}

export function passwordResetMail(args: { to: string; url: string; ttlMin: number }): Mail {
  const text = `비밀번호를 재설정하려면 아래 주소로 접속하세요. (${args.ttlMin}분 뒤 만료)

${args.url}

본인이 요청한 것이 아니라면 이 메일을 무시하셔도 됩니다. 비밀번호는 그대로 유지됩니다.
이 링크는 한 번만 사용할 수 있습니다.`;

  return {
    to: args.to,
    subject: `[${BRAND}] 비밀번호 재설정`,
    text,
    html: shell(
      "비밀번호 재설정",
      `<p style="margin:0;font-size:14px;">아래 버튼을 눌러 새 비밀번호를 설정하세요. 링크는 <strong>${args.ttlMin}분 뒤 만료</strong>되며 한 번만 사용할 수 있습니다.</p>
       <p style="margin:16px 0 0;font-size:13px;color:#71717a;">본인이 요청한 것이 아니라면 무시하셔도 됩니다. 비밀번호는 그대로 유지됩니다.</p>`,
      { href: args.url, label: "비밀번호 재설정하기" },
    ),
  };
}

/**
 * GitHub 로만 가입한 계정이 재설정을 요청한 경우.
 *
 * "그런 계정 없음" 을 돌려주면 계정 열거가 되고, 재설정 링크를 주면
 * GitHub 계정에 비밀번호를 새로 다는 셈이라 놀랍다. 그래서 안내 메일만 보낸다.
 */
export function oauthOnlyMail(args: { to: string; provider: string }): Mail {
  const text = `비밀번호 재설정을 요청하셨지만, 이 이메일은 ${args.provider} 계정으로 가입되어 있어 설정된 비밀번호가 없습니다.

${args.provider} 로 로그인해주세요.

본인이 요청한 것이 아니라면 이 메일을 무시하셔도 됩니다.`;

  return {
    to: args.to,
    subject: `[${BRAND}] 비밀번호 재설정 안내`,
    text,
    html: shell(
      "이 계정은 비밀번호를 쓰지 않습니다",
      `<p style="margin:0;font-size:14px;">이 이메일은 <strong>${args.provider}</strong> 계정으로 가입되어 있어 설정된 비밀번호가 없습니다. ${args.provider} 로 로그인해주세요.</p>
       <p style="margin:16px 0 0;font-size:13px;color:#71717a;">본인이 요청한 것이 아니라면 무시하셔도 됩니다.</p>`,
    ),
  };
}
