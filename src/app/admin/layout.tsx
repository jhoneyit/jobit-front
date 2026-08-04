import type { Metadata } from "next";
import "./admin.css";

/**
 * 관리자 콘솔의 바깥 껍데기.
 *
 * 로그인 화면과 대시보드가 **둘 다** 여기를 지난다. 인증 검사는 여기가 아니라
 * `(dash)/layout.tsx` 에 있다 — 로그인 화면까지 막으면 들어갈 방법이 없다.
 */
export const metadata: Metadata = {
  title: { default: "관리자", template: "%s | 관리자" },
  // 관리자 화면은 검색에 절대 올라가면 안 된다.
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}</div>;
}
