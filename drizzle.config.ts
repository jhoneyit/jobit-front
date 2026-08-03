import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

/**
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
      "  로컬 Postgres 를 쓰려면:",
      "    docker run -d --name jobit-pg -e POSTGRES_PASSWORD=jobit -e POSTGRES_DB=jobit \\",
      "      -p 55432:5432 pgvector/pgvector:pg17",
      "    DATABASE_URL=postgresql://postgres:jobit@localhost:55432/jobit",
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
