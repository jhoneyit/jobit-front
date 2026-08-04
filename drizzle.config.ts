import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

/**
 * ⚠️ **이 설정은 이제 조회 전용(`db:studio`)이다.**
 *
 * 2026-08-04 DB 단일화로 스키마 소유권이 `jobit` 의 Flyway 로 넘어갔다. 한 DB 에
 * 마이그레이션 도구가 둘이면 반드시 어긋나므로 `db:generate`/`db:migrate`/`db:push`
 * 스크립트는 제거했다. 컬럼을 바꾸려면 `jobit/src/main/resources/db/migration/` 에
 * 마이그레이션을 추가하고, 그 다음 `src/lib/db/schema.ts` 를 맞춘다.
 *
 * drizzle-kit 은 Next 와 달리 `.env.local` 을 자동으로 읽지 않는다.
 * 그래서 Next 가 쓰는 것과 **같은 로더**를 직접 부른다 — 로딩 우선순위가 어긋나지 않는다.
 * (이게 없으면 `.env.local` 을 제대로 채워 놓고도 `npm run db:migrate` 가
 *  "Please provide required params for Postgres driver: url: ''" 로 죽는다.)
 */
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;

if (!url) {
  console.error(
    [
      "",
      "DATABASE_URL 이 없습니다.",
      "",
      "  .env.local 에 아래 형태로 넣어주세요:",
      "    DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require",
      "",
      "  jobit 서버와 같은 DB 를 쓴다 — 그쪽 Docker 를 먼저 띄운다:",
      "    cd ../jobit && docker compose up -d",
      "    DATABASE_URL=postgresql://jobit:jobit@localhost:5432/jobit",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
