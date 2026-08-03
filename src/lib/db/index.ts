import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

/**
 * Drizzle + postgres-js 클라이언트.
 *
 * Neon 은 일반 Postgres 연결을 그대로 받으므로 postgres-js 로 붙는다.
 * (@neondatabase/serverless 대신 postgres-js 를 쓰는 이유: 로컬 Postgres·Supabase·Neon 을
 *  DATABASE_URL 만 바꿔서 똑같이 쓸 수 있다. 서버리스에서 커넥션이 부족해지면
 *  Neon 의 pooler 엔드포인트(-pooler)를 URL 로 지정하면 된다.)
 *
 * 모듈 로드 시점에 연결을 만든다. 지연 초기화(Proxy)도 시도해 봤지만,
 * Auth.js 의 DrizzleAdapter 가 **설정 시점에** `instanceof` 로 DB 종류를 판별하기 때문에
 * 어차피 그 자리에서 연결이 강제된다 — 복잡도만 늘고 이득이 없었다.
 *
 * 따라서 `next build` 에도 DATABASE_URL 이 필요하다. 스키마에 접속하진 않으므로
 * 형식만 맞으면 되고, CI 에서는 더미 URL 을 넣어도 빌드가 통과한다.
 */

const MISSING_URL = [
  "DATABASE_URL 이 설정되지 않았습니다.",
  "",
  "  .env.local 에 아래 형태로 넣어주세요:",
  "    DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require",
  "",
  "  로컬 Postgres 로 띄우려면:",
  "    docker run -d --name jobit-pg -e POSTGRES_PASSWORD=jobit -e POSTGRES_DB=jobit \\",
  "      -p 55432:5432 pgvector/pgvector:pg17",
  "    DATABASE_URL=postgresql://postgres:jobit@localhost:55432/jobit",
  "",
  "  넣은 뒤에는 `npm run db:migrate` 로 스키마를 적용해야 합니다.",
].join("\n");

const url = process.env.DATABASE_URL;
if (!url) throw new Error(MISSING_URL);

const g = globalThis as typeof globalThis & {
  __jobitSql?: ReturnType<typeof postgres>;
};

// dev 의 HMR 이 모듈을 다시 평가할 때마다 풀을 새로 만들면 금방 한도에 걸린다.
const sql =
  g.__jobitSql ??
  postgres(url, {
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    idle_timeout: 20,
    // Neon/Supabase 는 TLS 필수. 로컬은 자동으로 끈다.
    ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
  });

if (process.env.NODE_ENV !== "production") g.__jobitSql = sql;

export const db = drizzle(sql, { schema });

export { schema };
