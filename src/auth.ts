import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";

/**
 * GitHub OAuth (스펙 §2 "인증: 초기 없음 → 익명 세션 쿠키 → GitHub OAuth").
 *
 * 개발자 타깃이라 GitHub 계정이 이미 있는 사용자가 대부분이고,
 * 비밀번호를 우리가 보관하지 않아도 된다는 게 §6 개인정보 항목에서 유리하다.
 *
 * 세션 전략은 database — Drizzle 어댑터가 session 테이블에 저장한다.
 * JWT 가 아니라 DB 세션을 쓰는 이유는 3단계에서 이력서에 TTL(`expires_at`)을 걸 때
 * 세션 만료와 데이터 만료를 같은 곳에서 다루는 편이 낫기 때문.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [GitHub],
  /**
   * Auth.js v5 는 프로덕션에서 Host 헤더를 기본적으로 신뢰하지 않는다 (UntrustedHost).
   * Vercel 은 자동 감지되지만, 셀프호스팅·리버스 프록시·Docker 뒤에서는 세션이 통째로 거부된다.
   *
   * 그래서 신뢰하도록 켜 두되, **운영에서는 AUTH_URL 을 명시하는 편이 안전하다** —
   * 그래야 Host 헤더를 위조해 OAuth 콜백 URL 을 바꾸는 시도를 원천 차단할 수 있다.
   */
  trustHost: true,
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    session({ session, user }) {
      // 조회 쿼리가 owner_key 를 만들려면 user.id 가 세션에 있어야 한다.
      if (session.user) {
        session.user.id = user.id;
        // DrizzleAdapter 는 user 행을 통째로 넘긴다. 그대로 두면 password_hash 가
        // /api/auth/session 응답에 실려 브라우저로 새어 나간다 — 반드시 지운다.
        delete (session.user as { passwordHash?: unknown }).passwordHash;
      }
      return session;
    },
  },
});
