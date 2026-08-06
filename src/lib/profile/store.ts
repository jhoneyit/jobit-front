import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { jdSubmissions, jobPostings, userProfiles } from "@/lib/db/schema";
import type { Profile } from "@/lib/profile/types";
import type { ParsedJd } from "@/lib/types";

/**
 * 내 정보 저장소.
 *
 * 소유자당 한 행이라 `owner_key` 가 PK 이고, 조회·저장이 모두 그 키 하나로 끝난다.
 * 로그인 여부로 분기하지 않는다 — `anon:` 도 `user:` 도 같은 경로다.
 */

export async function getProfile(ownerKey: string): Promise<Profile | null> {
  const [row] = await db
    .select({ yearsOfExp: userProfiles.yearsOfExp, stacks: userProfiles.stacks })
    .from(userProfiles)
    .where(eq(userProfiles.ownerKey, ownerKey))
    .limit(1);

  return row ? { yearsOfExp: row.yearsOfExp, stacks: row.stacks } : null;
}

export async function saveProfile(ownerKey: string, profile: Profile): Promise<void> {
  await db
    .insert(userProfiles)
    .values({
      ownerKey,
      yearsOfExp: profile.yearsOfExp,
      stacks: profile.stacks,
    })
    .onConflictDoUpdate({
      target: userProfiles.ownerKey,
      set: {
        yearsOfExp: profile.yearsOfExp,
        stacks: profile.stacks,
        updatedAt: new Date(),
      },
    });
}

/**
 * 익명으로 채워 둔 프로필을 계정으로 옮긴다.
 *
 * <b>계정에 이미 프로필이 있으면 익명 것을 버린다.</b> 계정 쪽이 정본이다 — 다른 기기에서
 * 공들여 입력해 둔 값을 이 브라우저의 임시 입력이 덮어쓰면 안 된다.
 * 어느 쪽이든 익명 행은 지운다. 남겨 두면 로그아웃했을 때 옛 값이 되살아난다.
 *
 * @returns 실제로 옮겼으면 true
 */
export async function claimAnonProfile(fromKey: string, toKey: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [anon] = await tx
      .select({ yearsOfExp: userProfiles.yearsOfExp, stacks: userProfiles.stacks })
      .from(userProfiles)
      .where(eq(userProfiles.ownerKey, fromKey))
      .limit(1);

    if (!anon) return false;

    const inserted = await tx
      .insert(userProfiles)
      .values({ ownerKey: toKey, yearsOfExp: anon.yearsOfExp, stacks: anon.stacks })
      .onConflictDoNothing({ target: userProfiles.ownerKey })
      .returning({ ownerKey: userProfiles.ownerKey });

    await tx.delete(userProfiles).where(eq(userProfiles.ownerKey, fromKey));
    return inserted.length > 0;
  });
}

/**
 * 입력 화면의 추천 칩 — 내가 넣어 본 공고들에 등장한 스택.
 *
 * 빈 칸에 처음부터 타이핑하게 두면 대부분 두세 개 적고 그만둔다. 이미 이 사람이 관심을 보인
 * 공고에서 뽑아 주면 눌러서 채울 수 있다. 순수 조회이고 LLM 을 타지 않는다.
 */
export async function suggestStacks(ownerKey: string, limit = 12): Promise<string[]> {
  const rows = await db
    .select({ parsed: jobPostings.parsed })
    .from(jdSubmissions)
    .innerJoin(jobPostings, eq(jdSubmissions.jobPostingId, jobPostings.id))
    .where(eq(jdSubmissions.ownerKey, ownerKey))
    .orderBy(desc(jdSubmissions.createdAt))
    .limit(20);

  // 등장 횟수 순. 여러 공고에 나온 스택일수록 이 사람과 관련이 깊다.
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const s of (row.parsed as ParsedJd).stack ?? []) {
      const name = s.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

/** 소유자 수 — 관리자 화면이 붙을 때를 위한 최소 통계. */
export async function countProfiles(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(userProfiles);
  return row?.n ?? 0;
}
