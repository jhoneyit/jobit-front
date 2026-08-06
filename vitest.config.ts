import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * 테스트 설정.
 *
 * **순수 함수만 테스트한다.** 이 레포의 로직은 대부분 서버 컴포넌트나 DB 접근이라
 * 테스트하려면 렌더러와 Postgres 를 붙여야 하는데, 그 값어치가 나오는 지점은 아직 없다.
 * 반면 `lib/profile/match.ts` 는 정규화·별칭·판정이 얽힌 순수 함수라 회귀가 나기 쉽고
 * 눈으로 확인하기 어렵다 — 그래서 러너를 들였다.
 *
 * jsdom 을 붙이지 않은 것도 같은 이유다. DOM 이 필요해지면 그때 environment 를 올린다.
 */
export default defineConfig({
  resolve: {
    // tsconfig 의 "@/*" → "./src/*" 를 그대로 맞춘다. 어긋나면 임포트가 런타임에만 깨진다.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
