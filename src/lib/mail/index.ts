/**
 * 메일 발송 — 드라이버 방식.
 *
 * `RESEND_API_KEY` 가 있으면 Resend 로 실제 발송하고, 없으면 콘솔에 찍는다.
 * 개발 중에는 계정 없이 링크를 눌러 볼 수 있고, 운영에서는 키만 넣으면 된다.
 *
 * Resend 는 REST 라 SDK 없이 fetch 로 붙는다 — 의존성이 늘지 않는다.
 * SMTP 가 필요해지면 `Mailer` 를 구현한 드라이버를 하나 더 만들어 아래 선택 로직에만 끼우면 된다.
 */

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  readonly name: string;
  send(mail: Mail): Promise<void>;
}

/** 개발용 — 실제로 보내지 않고 콘솔에 남긴다. */
const consoleMailer: Mailer = {
  name: "console",
  async send(mail) {
    console.log(
      [
        "",
        "─".repeat(72),
        "  메일 발송 (콘솔 드라이버 — 실제로 전송되지 않았습니다)",
        `  받는사람 : ${mail.to}`,
        `  제목     : ${mail.subject}`,
        "─".repeat(72),
        mail.text,
        "─".repeat(72),
        "",
      ].join("\n"),
    );
  },
};

function resendMailer(apiKey: string, from: string): Mailer {
  return {
    name: "resend",
    async send(mail) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        }),
      });

      if (!res.ok) {
        // 본문에 수신자 주소가 섞일 수 있어 상태코드만 남긴다.
        throw new Error(`Resend 발송 실패 (HTTP ${res.status})`);
      }
    },
  };
}

export function mailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (apiKey && from) return resendMailer(apiKey, from);

  if (apiKey && !from) {
    console.warn("[mail] RESEND_API_KEY 는 있는데 MAIL_FROM 이 없어 콘솔로 대체합니다.");
  } else if (process.env.NODE_ENV === "production") {
    console.warn(
      "[mail] 운영 환경인데 메일 드라이버가 없습니다. 재설정 링크가 콘솔에만 남습니다.",
    );
  }
  return consoleMailer;
}

/** 링크 생성용 기준 URL. 배포 환경에서 AUTH_URL 을 쓰는 이유는 §알려진 제약 참고. */
export function baseUrl(): string {
  const explicit = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}
