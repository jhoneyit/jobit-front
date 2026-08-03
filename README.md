# jobit — JD 기반 기술 면접 준비

채용공고를 붙여넣으면 그 공고에 맞는 예상 면접 질문과 답변 뼈대를 만들어 주는 웹 서비스.
[`jd-interview-prep-spec.md`](#) 스펙의 **1단계** 구현 — JD 붙여넣기 → 파싱 → 질문 10개(스트리밍).

## 시작하기

```bash
cp .env.example .env.local   # 먼저 값을 채운다 (아래 표)
npm install
npm run db:migrate           # 스키마 적용
npm run dev                  # http://localhost:3000
```

> `drizzle-kit` 은 Next 와 달리 `.env.local` 을 자동으로 읽지 않습니다.
> `drizzle.config.ts` 에서 Next 와 같은 로더(`@next/env`)를 직접 부르도록 해 뒀으니
> 셸에 `DATABASE_URL` 을 따로 export 할 필요는 없습니다.
> `DATABASE_URL` 은 `next build` 에도 필요합니다 — 접속하진 않으므로 CI 에서는 더미 URL 로도 통과합니다.

`.env.local` 에 넣어야 하는 값 4개 — 전부 직접 발급하셔야 합니다:

| 변수 | 어디서 |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `DATABASE_URL` | Neon 대시보드 → Connection string (pooler 엔드포인트 권장) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | [github.com/settings/developers](https://github.com/settings/developers) → New OAuth App<br>Callback URL: `http://localhost:3000/api/auth/callback/github` |
| `AUTH_SECRET` | `openssl rand -base64 32` |

> **Node 20 또는 22 이상**이 필요합니다. (Next 16 요구사항 — 현재 v21 에서는 설치 시 engine 경고가 뜹니다)

### DB 없이 훑어보고 싶다면

Docker 로 로컬 Postgres 를 띄우면 Neon 계정 없이 전부 돌아갑니다:

```bash
docker run -d --name jobit-pg -e POSTGRES_PASSWORD=jobit -e POSTGRES_DB=jobit \
  -p 55432:5432 pgvector/pgvector:pg17
# .env.local
# DATABASE_URL=postgresql://postgres:jobit@localhost:55432/jobit
npm run db:migrate
```

`localhost` 가 URL 에 있으면 SSL 을 자동으로 끕니다. pgvector 이미지를 쓰는 이유는 3단계 갭 분석에서 그대로 이어 쓰기 위해서입니다.

## 구조

```
src/
├─ auth.ts                      Auth.js v5 (GitHub OAuth + Drizzle 어댑터)
├─ app/
│  ├─ page.tsx                  ★ 랜딩 (브랜드 전용 — 입력 폼 없음)
│  ├─ analyze/page.tsx          ★ 공고 분석 (JD 입력)
│  ├─ history/page.tsx          ★ 내 기록 — 넣은 공고와 결과 조회
│  ├─ signin/page.tsx           로그인 (GitHub + 이메일)
│  ├─ signup/page.tsx           회원가입 (GitHub + 이메일)
│  ├─ forgot-password/page.tsx  ★ 재설정 링크 요청
│  ├─ reset-password/page.tsx   ★ 새 비밀번호 설정 (토큰)
│  ├─ account/page.tsx          ★ 계정 설정 · 비밀번호 변경
│  ├─ result/[id]/page.tsx      결과 (SSR — 공유 링크 SEO 대비)
│  ├─ actions/                  signIn/signOut · 제출 이력 삭제 (Server Actions)
│  └─ api/
│     ├─ auth/[...nextauth]/    Auth.js 콜백
│     ├─ jd/parse/route.ts      §4.1 정규화 → 해시 → 캐시 → LLM
│     ├─ questions/route.ts     §4.2 질문 생성 (SSE 스트리밍)
│     └─ cost/route.ts          §3.5 비용 대시보드 (dev 전용)
├─ components/
│  ├─ landing/                  ★ Hero · HeroDemo · StickySteps · Reveal (motion)
│  ├─ SmoothScroll.tsx          ★ Lenis 관성 스크롤
│  └─ SiteHeader · UserMenu · JdInputForm · QuestionStream …
└─ lib/
   ├─ db/schema.ts              ★ Drizzle 스키마 (§3 + Auth.js + jd_submission)
   ├─ db/index.ts               커넥션 풀
   ├─ store.ts                  저장소 — Drizzle 쿼리
   ├─ owner.ts                  ★ owner_key 규약 (user:<id> | anon:<쿠키>)
   ├─ claim.ts                  ★ 익명 기록 → 계정 승계
   ├─ auth/password.ts          ★ scrypt 해싱 + 비밀번호 정책
   ├─ auth/credentials.ts       ★ 이메일 계정 생성·검증
   ├─ auth/session.ts           DB 세션 직접 발급/폐기
   ├─ auth/reset.ts             ★ 재설정 토큰 발급·검증·소비
   ├─ mail/                     ★ 메일 드라이버 (Resend | 콘솔) + 템플릿
   ├─ types.ts                  도메인 타입
   ├─ rate-limit.ts             익명 세션 쿠키 + 세션당 호출 제한
   ├─ jd/normalize.ts           본문 정규화 + content_hash
   ├─ jd/parse.ts               JD 파싱 (구조화 출력 + 재검증 + 폴백)
   ├─ questions/generate.ts     질문 생성 (스트리밍)
   └─ llm/                      config · prompts · schema · incremental-array · client · cost
```

## 랜딩 페이지

`/` 는 브랜드 전용입니다. **입력 폼은 `/analyze` 로 분리**했고 랜딩은 그리로 보내는 역할만 합니다.

- **보여주고 나서 설명한다** — 이 제품의 경험은 "붙여넣으면 질문이 하나씩 흘러나온다"입니다.
  글로 설명하는 대신 히어로에서 그 장면을 재연합니다(`HeroDemo`: 타이핑 → 요구사항 추출 → 질문 스트리밍).
- **full-bleed** — `.bleed` 로 본문 컬럼(820px)을 뚫고 화면 전체를 씁니다. 컬럼 안에 가두면
  아무리 꾸며도 글 문서처럼 보입니다. 헤더도 같은 이유로 full-bleed 입니다.
- **히어로는 라이트/다크 모두 어두운 밴드**입니다 — 첫인상을 여기서 만듭니다.
- 최상단에서는 헤더가 히어로 위에 투명하게 얹힙니다(`HeaderChrome`). 내리면 평소 헤더로 돌아옵니다.
- **스크롤 연출** — `motion` 으로 히어로 패럴랙스와 섹션 리빌, 3단계 sticky 시퀀스를 만들고
  `lenis` 로 관성 스크롤을 겁니다.

`prefers-reduced-motion` 을 켠 사용자에게는 **관성 스크롤을 아예 걸지 않고**(멀미 유발),
모든 애니메이션이 완성 상태의 정지 화면으로 나옵니다.

## 화면 테마

헤더의 아이콘 버튼으로 **시스템 → 라이트 → 다크**를 순환합니다. 선택은 `localStorage` 에 남습니다.

CSS 는 라이트/다크 값을 각각 `--l-*`, `--d-*` 로 **한 번만** 정의하고 매핑만 세 경우로 나눕니다:

```
1) 기본                                      → 라이트
2) OS 가 다크 + 사용자가 라이트를 고르지 않음  → 다크
3) 사용자가 다크를 직접 고름 (OS 보다 우선)    → 다크
```

값이 한 곳에만 있으므로 한쪽만 고쳐 색이 어긋나는 일이 없습니다.

저장된 테마는 `layout.tsx` 의 인라인 스크립트가 **첫 페인트 전에** 적용합니다 —
React 가 붙은 뒤에 적용하면 다크를 고른 사용자에게 흰 화면이 한 번 번쩍입니다.
토글은 `useSyncExternalStore` 로 localStorage 를 읽어 다른 탭의 변경도 따라갑니다.
localStorage 가 막힌 환경에서는 조용히 `prefers-color-scheme` 으로 넘어갑니다.

## 회원과 조회 페이지

가입 경로는 두 가지이고, 둘 다 같은 `user` 테이블·같은 세션 방식을 씁니다.

| 경로 | 화면 | 구현 |
|---|---|---|
| GitHub OAuth | `/signin`, `/signup` | Auth.js v5 + Drizzle 어댑터 |
| 이메일 + 비밀번호 | `/signup` | 직접 구현 (아래 참고) |
| 비밀번호 재설정 | `/forgot-password` → 메일 → `/reset-password` | 1회용 토큰 |
| 비밀번호 변경·설정 | `/account` | 현재 비밀번호 확인 후 변경 |

### 왜 Credentials provider 를 쓰지 않았나

Auth.js v5 의 credentials 처리 경로(`@auth/core/lib/actions/callback/index.js`)는
`session.strategy` 가 `"database"` 여도 **무조건 JWT 를 만들어 세션 쿠키에 넣습니다** —
`adapter.createSession` 을 호출하지 않습니다.

그 상태로 `auth()` 를 부르면 DB 전략이라 세션 토큰으로 `session` 테이블을 조회하는데,
JWT 문자열은 어느 행에도 맞지 않아 **로그인은 성공했는데 로그아웃 상태로 보이는** 증상이 납니다.

선택지는 둘이었습니다:

1. 전체를 JWT 세션으로 전환 → GitHub 쪽까지 바뀌고, 서버측 세션 무효화를 잃습니다.
2. **credentials 로그인만 Auth.js 를 우회해 세션 행을 직접 발급** ← 이쪽을 택했습니다.

3단계에서 이력서(§6 개인정보)를 다루려면 서버에서 세션을 즉시 끊을 수 있어야 하고,
이미 검증된 GitHub 흐름을 갈아엎지 않는 편이 안전하다고 봤습니다.
`lib/auth/session.ts` 가 Auth.js 규약(테이블·쿠키 이름)을 그대로 따르므로
`auth()` 조회와 `signOut()` 폐기는 두 경로가 완전히 동일하게 동작합니다.

### 비밀번호 처리

- **scrypt** (`N=2^15, r=8, p=1`) — Node 내장이라 네이티브 빌드가 없습니다. 해싱 약 100ms.
  저장 형식 `scrypt$N$r$p$salt$hash` 라 나중에 파라미터를 올려도 기존 해시를 읽습니다.
- 최소 10자. **특수문자·대문자 강제는 하지 않습니다** — 사용자를 `Password1!` 로 몰아갈 뿐
  실제 엔트로피는 길이에서 나옵니다. 대신 숫자만·흔한 문자열은 막습니다.
- 한글 조합형/완성형을 NFKC 로 정규화해 같은 비밀번호로 취급합니다.
- **계정 열거 방지** — 없는 이메일도 더미 해시로 같은 비용을 치릅니다 (측정값 103ms vs 104ms).
- 로그인 실패 8회 / 15분 제한 (이메일 기준).

### 비밀번호 재설정

`/forgot-password` 에서 이메일 입력 → 메일의 링크 → `/reset-password` 에서 새 비밀번호.

- 토큰은 32바이트 난수이고, **DB 에는 SHA-256 만 저장**합니다. DB 가 유출돼도 그 값으로는
  재설정할 수 없습니다. (비밀번호와 달리 느린 해시가 필요 없습니다 — 256비트 난수라
  사전 공격 대상이 아니고, 링크 클릭마다 검증하므로 빨라야 합니다.)
- **30분 만료, 1회용.** 소비는 `used_at IS NULL` 조건부 UPDATE 라 동시 요청에도 정확히 한 번만 성공합니다.
- 재발급하면 그 사용자의 이전 미사용 토큰을 전부 무효화합니다.
- **성공 시 모든 세션을 폐기합니다.** 재설정하는 상황은 계정이 이미 털렸을 가능성을
  전제하므로, 남은 세션을 살려 두면 재설정이 무의미합니다.
- 링크 접속은 그 주소를 통제한다는 뜻이므로 `emailVerified` 로 표시합니다.
- **계정 열거 방지**: 가입 여부·한도 초과·GitHub 계정 여부와 무관하게 항상 같은 화면을 돌려줍니다.
  실제 분기는 "어떤 메일을 보낼지"에서만 일어납니다. 요청은 1시간에 5회로 제한합니다.
- GitHub 로만 가입한 계정에는 재설정 링크 대신 안내 메일을 보냅니다 — 이메일 소유를
  검증하지 않은 상태에서 링크를 주면 GitHub 계정에 비밀번호를 새로 다는 셈이라서입니다.
  (그 계정도 로그인한 뒤 `/account` 에서 직접 비밀번호를 설정할 수 있습니다.)

### 메일 발송

`RESEND_API_KEY` + `MAIL_FROM` 이 있으면 Resend 로 보내고, 없으면 **콘솔에 출력**합니다.
개발 중에는 계정 없이 서버 로그의 링크를 눌러 확인하면 되고, 운영에서는 키만 넣으면 됩니다.
Resend 는 REST 라 SDK 없이 `fetch` 로 붙습니다 — 의존성이 늘지 않습니다.
SMTP 가 필요하면 `Mailer` 인터페이스를 구현한 드라이버를 하나 더 만들어 끼우면 됩니다.

> ⚠️ **운영에서 `RESEND_API_KEY` 를 비워 두면 사용자가 재설정 메일을 받지 못합니다.**
> (서버 콘솔에만 링크가 남습니다. 시작 시 경고를 출력합니다.)

> **아직 없는 것:** 가입 시점의 이메일 인증. 지금은 재설정 링크를 열어야 인증됩니다.
> 즉 오타난 주소로 가입하면 그 계정은 재설정으로 복구할 수 없습니다.

### owner_key 하나로 로그인 전후를 통일한다

스펙 §3.3 이 `owner_key text, -- 익명 세션 키 또는 user_id` 라고 적어 둔 걸 그대로 구현했습니다.

```
로그인함   → "user:<userId>"
비로그인   → "anon:<익명 세션 쿠키>"
```

접두사를 붙여 두면 두 네임스페이스가 충돌하지 않고, 조회 쿼리는 `owner_key` 하나만 보면 되므로
**로그인 여부로 분기하는 코드가 없습니다.** 3단계에서 `resume.owner_key` 도 같은 함수를 씁니다.

로그인 전에 쌓은 기록은 `/history` 첫 진입 때 계정으로 승계됩니다. 이게 없으면
"질문 만들어 보고 마음에 들어서 로그인했더니 방금 만든 게 사라진" 상태가 됩니다.

### 왜 `jd_submission` 테이블을 새로 만들었나

스펙에 없는 유일한 테이블입니다. `job_posting` 에 `owner_key` 컬럼을 붙이지 않은 이유:

§4.1 의 캐시는 **"같은 공고 = 같은 로우"** 에 기대고 있습니다(`content_hash` unique).
`job_posting` 에 소유자를 달면 같은 공고를 두 사람이 넣을 때 로우를 두 개 만들어야 하고,
그 순간 unique 제약과 캐시 적중률이 동시에 무너집니다.

그래서 **공고(공유 자산)와 제출 이력(개인 자산)을 분리**했습니다. 목록에서 삭제해도
`jd_submission` 행만 지우고 `job_posting` 은 남습니다 — 다른 사람의 캐시를 깨지 않기 위해서입니다.

## 화면

- **`/` 랜딩** — 히어로 바로 아래에 입력창을 둡니다. 스펙 §5 의 1단계는 "붙여넣으면 질문이
  나온다" 하나로 가치를 증명하는 것이라, 설득 문구보다 입력을 먼저 놓았습니다.
  아래로 차별점 3장 → 실제 결과 예시 → 이력서 갭 분석(3단계) 예고 순입니다.
- **헤더** — sticky. 현재 위치를 `aria-current` 와 밑줄로 표시합니다.
  로그인하면 아바타 버튼이 뜨고, 누르면 계정 드롭다운이 열립니다.
- **계정 드롭다운** — 라이브러리 없이 직접 만들었고 접근성 요건을 챙겼습니다:
  `aria-haspopup`/`aria-expanded`, Escape 로 닫고 포커스 복귀, 바깥 클릭·라우트 이동 시 자동 닫힘,
  위/아래 방향키로 항목 이동.

## 스펙 대비 구현 상태

### 엔지니어링 체크리스트 (§6)

| 항목 | 상태 | 어디에 |
|---|---|---|
| SSE 스트리밍 (토큰 단위 렌더링) | ✅ | `api/questions` + `incremental-array.ts` |
| 구조화 출력 + 서버 재검증, 실패 시 재시도 | ✅ | `llm/schema.ts`, `jd/parse.ts` (zod 재검증 + 2회 재시도) |
| 동일 입력 캐싱 | ✅ | `content_hash` (§4.1) + `prompt_version` (§4.2) |
| 레이트 리밋 / 프롬프트 주입 방어 | ✅ | `rate-limit.ts`, `prompts.ts` (`<job_posting>` 격리) |
| 모델 장애 시 폴백 | ✅ | `client.ts` `modelChain()` — 5xx/429/연결오류에만 폴백 |
| `llm_call_log` 기반 비용 대시보드 | ✅ | `llm/cost.ts` + `GET /api/cost` |

### 단계별 로드맵 (§5)

- **1단계** ✅ JD 붙여넣기 → 파싱 → 질문 10개 (스트리밍).
- **2단계** 🔶 꼬리질문·답변 뼈대 ✅, 질문 저장 ✅ (DB). 남은 것: 공유 링크(`/q/[slug]`).
- 3단계 — 이력서 업로드 → 갭 분석 표. `resume` / `gap_analysis` 테이블과 pgvector 필요.
- 4단계 — WEAK 항목 리라이트 + 채택 UI.
- 5단계 — 질문 은행 RAG.

> **스펙과 다른 점:** 인증·DB 는 스펙이 3단계(이력서 저장 시점)로 미뤄 둔 항목인데 먼저 넣었습니다.
> 이메일+비밀번호 가입은 스펙에 아예 없습니다 — §2 는 `초기 없음 → 익명 세션 쿠키 → GitHub OAuth`
> 만 정의합니다. GitHub OAuth 를 대체한 게 아니라 함께 제공하는 추가 경로입니다.
> §5 는 `1단계는 로그인도 DB 저장도 없이 만든다. 로그인부터 붙이면 제품 가치를 확인하기도 전에
> 주말 세 번이 날아간다` 고 경고합니다. 회원별 조회 페이지를 만들려면 영속성이 전제라 불가피했지만,
> 스펙의 우선순위와는 어긋난 선택이라는 점은 기록해 둡니다.

`llm/config.ts` 에는 3·4단계용 모델 설정(`GAP_ANALYSIS`, `REWRITE`)이 미리 들어가 있습니다.
`lib/types.ts` 는 1·2단계 테이블(§3.1·3.2·3.5)만 담고 있고, `resume` / `gap_analysis` 계열(§3.3·3.4)은
해당 단계에서 추가하면 됩니다.

## 스트리밍이 실제로 어떻게 도는가

구조화 출력을 쓰면 모델은 `{"questions":[{...},{...}]}` 를 토큰 단위로 흘려보냅니다.
전부 받고 `JSON.parse` 하면 사용자는 10초를 빈 화면으로 봅니다. 그래서:

1. `IncrementalArrayParser` 가 흘러오는 텍스트에서 문자열/이스케이프 상태를 추적하며 중괄호를 셉니다.
2. 배열 원소 하나가 `}` 로 닫히는 순간 그 조각만 파싱해서
3. zod 로 검증하고 (어긋나면 그 질문만 버림)
4. SSE 프레임으로 즉시 클라이언트에 밀어줍니다.

목 서버로 측정한 실제 도착 시각 — 첫 질문이 전체 완료보다 한참 앞서 도착합니다:

```
+    9ms  meta
+  156ms  question
+  290ms  question
+  380ms  question
+  386ms  done
```

## 모델 설정

`src/lib/llm/config.ts` 한 곳에 모여 있습니다.

스펙 §2 는 "파싱은 저렴한 모델 / 리라이트는 상위 모델"로 티어를 나누라고 합니다.
다만 텍스트 품질이 곧 제품 가치인 유형(§6)이라, **기본값은 전부 `claude-opus-5` 로 두고
비용은 `effort` 로 먼저 조절**했습니다 — 파싱은 `low`, 질문 생성은 `high`.

`/api/cost` 로 어느 기능이 돈을 먹는지 확인한 뒤, 필요하면 `MODEL_CONFIG` 의 `model` 만
바꿔서 티어를 내리면 됩니다.

## 알려진 제약

- **레이트 리밋이 아직 인스턴스 메모리에 있습니다.** 다중 인스턴스로 늘리면 Redis 나
  Postgres 로 옮겨야 합니다 (`lib/rate-limit.ts` 한 파일).
- **`AUTH_URL` 을 운영에서 설정하세요.** `auth.ts` 에 `trustHost: true` 가 켜져 있습니다 —
  없으면 Vercel 밖(셀프호스팅·프록시 뒤)에서 세션이 통째로 거부됩니다(`UntrustedHost`).
  다만 켜 두면 Host 헤더를 신뢰하게 되므로, 운영에서는 `AUTH_URL` 을 명시해 OAuth 콜백 URL
  위조 가능성을 막는 편이 안전합니다.
- **비밀번호 재설정이 없습니다.** 이메일 인증 수단이 없어서입니다 (위 §비밀번호 처리 참고).
- **이력서(§3.3)는 아직 없습니다.** 개인정보 암호화와 `expires_at` TTL 은 3단계에서
  이력서를 받을 때 같이 들어갑니다. 지금 저장되는 건 공고 본문과 생성된 질문뿐입니다.
- `npm audit` 에 high 3건이 뜨는데 전부 Next 16 의 전이 의존성(`postcss`, `sharp`)이고
  `audit fix --force` 는 next@9 로 내리려 합니다. 손대지 마세요 — Next 업스트림 픽스를 기다립니다.

## 아직 열려 있는 결정 (§7)

- 유료화 시점과 과금 단위 (횟수제 / 구독)
- 어필리에이트 배치 위치
- 3단계에서 이력서 원문 암호화 방식과 `expires_at` TTL 값

## 스크립트

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```
