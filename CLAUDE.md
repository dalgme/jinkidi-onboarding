# 온보딩 허브 — CLAUDE.md

> 프로젝트 루트에 이 파일을 그대로 둔다. 매 Claude Code 세션이 자동 참조한다.
> 설계 근거는 「온보딩 허브 설계 문서 v1.0」을 참조.

## 1. 프로젝트 정체성

개발사가 외부 의뢰를 받아 플랫폼을 구축할 때, 결과물을 처음부터 의뢰인 명의 계정
(GitHub Organization / Vercel Team / Supabase Organization / 도메인)에 귀속시키는
온보딩 절차를 **프로젝트 단위**로 관리하는 내부 도구.

- 타깃: B2B (개발사 내부 사용자 + 의뢰인 외부 사용자)
- 사용자 2종:
  - **개발사** — `/app`, 밀도 높은 테이블 중심, PC 우선
  - **의뢰인** — `/p`, 비개발자, 문장형 안내, 모바일 우선
- 수익 모델: 없음 (자사 전용). `agency_id`로 SaaS 확장만 대비
- 핵심 원칙: 계정 공유가 아니라 **권한 위임**. 시스템이 이 원칙을 강제한다

---

## 2. 기술 스택 (변경 금지)

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js App Router + TypeScript (strict) |
| 스타일 | Tailwind CSS + shadcn/ui |
| 폰트 | Pretendard Variable |
| DB | Supabase Postgres — **ap-northeast-2 (Seoul)** |
| 인증 | Supabase Auth `signInWithOtp` (매직링크 전용) |
| 스토리지 | Supabase Storage (private 버킷) |
| 폼 | React Hook Form + Zod |
| 마크다운 | react-markdown + rehype-sanitize |
| 아이콘 | lucide-react |
| 날짜 | date-fns (ko locale) |
| 차트 | recharts |
| 메일 | Resend + React Email |
| 크론 | Vercel Cron |
| 호스팅 | Vercel |
| 패키지 | pnpm |
| 테스트 | Vitest + Playwright |

구현 중 "다른 라이브러리가 더 낫다"는 판단으로 교체하지 않는다. 교체가 필요하면
설계 문서를 먼저 개정한다.

---

## 3. 폴더 구조

```
src/
  app/
    (auth)/
      login/
      auth/callback/
      invite/[token]/
    (agency)/app/
      page.tsx                       프로젝트 목록
      clients/
      projects/new/
      projects/[code]/
        page.tsx                     개요
        onboarding/
        intake/
        deliverables/
        cost/
        settings/
      templates/
    (portal)/p/[code]/
      page.tsx                       포털 홈
      steps/[key]/
      intake/
      deliverables/
      cost/
    api/
      verify/[type]/route.ts
      cron/reminders/route.ts
      upload/route.ts
    terms/  privacy/
  components/
    ui/            shadcn/ui
    common/        Header, Nav, EmptyState, ErrorState
    onboarding/    StepCard, ProgressBar, DeepLinkCard, VerifyButton
    intake/        QuestionField, IntakeProgress, AutoSaveIndicator
    deliverable/   DeliverableCard, FileUploader
    comment/       CommentThread, CommentForm
  lib/
    supabase/      client.ts, server.ts, middleware.ts
    verify/        github.ts, vercel.ts, supabase.ts, dns.ts
    mail/          resend.ts, templates/
    cost/          calculator.ts
    auth/          guards.ts
    utils/
  content/
    ko.ts          사용자 노출 문구 (한국어 하드코딩 금지)
  types/
supabase/
  migrations/
  seed.sql
```

---

## 4. 명명 규칙

- 파일·폴더: `kebab-case`
- React 컴포넌트: `PascalCase` (default export)
- 함수·변수: `camelCase`
- 상수: `UPPER_SNAKE_CASE`
- DB 테이블: `snake_case` 복수형
- DB 컬럼: `snake_case`
- 환경변수: `UPPER_SNAKE_CASE`, 클라이언트 노출만 `NEXT_PUBLIC_` 접두

---

## 5. TypeScript / React 규칙

- `strict`, `noUncheckedIndexedAccess` 활성. `any` 금지 (불가피하면 `unknown` + 타입 가드)
- React Server Components 우선. `'use client'`는 인터랙션이 필요할 때만
- 데이터 페칭은 Server Component에서 직접. `useEffect` + `fetch` 금지
- 폼은 React Hook Form + Zod로 통일
- 도메인 단위로 `error.tsx`, `loading.tsx` 배치

---

## 6. 스타일링

- 인라인 `style` 속성 금지 (`className`만)
- 임의값 `w-[123px]` 회피, 디자인 토큰 사용
- 컬러는 `tailwind.config.ts` `theme.extend`에만 정의. 컴포넌트에 hex 직접 금지
- `/p`는 모바일 우선·여백 넓게 / `/app`은 PC 우선·테이블 밀도 높게
- 터치 타깃 최소 44×44px
- 다크 모드 MVP 제외

---

## 7. 문구 관리 (i18n 대체)

- 한국어 단일. `next-intl` 도입하지 않음
- 사용자 노출 문구는 `src/content/ko.ts` 상수로 분리
- 컴포넌트에 한국어 문자열 직접 삽입 금지 — 향후 i18n 전환 시 키 추출을 위해

---

## 8. 데이터베이스 정책

- **모든 테이블 RLS 필수.** 테이블을 만드는 마이그레이션과 같은 파일에 정책을 함께 쓴다
- 마이그레이션은 `supabase/migrations/`에 SQL 파일로. 기존 파일 수정 금지 (새 파일로)
- PK는 UUID v4 (`gen_random_uuid()`)
- 모든 테이블에 `created_at`, `updated_at` (트리거로 자동 갱신)
- 삭제는 soft delete (`deleted_at`) 원칙
- 모든 FK에 `ON DELETE` 명시 — 하위 데이터 `CASCADE`, 참조 마스터 `RESTRICT`
- `jsonb` 컬럼에 GIN 인덱스
- RLS는 `my_agency_ids()` / `my_project_ids()` 헬퍼 함수를 경유
  (`SECURITY DEFINER`, `set search_path = public` 필수)

### 테이블 18개

`agencies` · `agency_members` · `clients` · `client_members` · `projects` ·
`project_members` · `onboarding_templates` · `onboarding_template_steps` ·
`project_steps` · `intake_forms` · `intake_responses` · `deliverables` ·
`comments` · `project_invites` · `notifications` · `cost_rates` ·
`cost_estimates` · `audit_logs`  (+ `consents`)

---

## 9. 인증·보안 정책

- Supabase Auth `signInWithOtp`(매직링크)만. 커스텀 인증·비밀번호 금지
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용. **`NEXT_PUBLIC_` 접두 절대 금지**
- 사용자 입력 100% Zod 검증. raw SQL 금지
- `author_side`, `agency_id`, 검증 결과는 **서버에서 결정** — 클라이언트 값 신뢰 금지
- 마크다운은 `rehype-sanitize`. `dangerouslySetInnerHTML` 금지
- Storage는 private 버킷 + 서버에서 `createSignedUrl(3600)` 발급
- 매직링크 만료는 24시간으로 설정 (기본값은 너무 짧다)

---

## 10. 상태 전이 규칙 — 도메인 핵심

```
project_steps.status
  pending → in_progress → client_done → verified
  any → blocked   (blocked_reason 필수)
  any → skipped   (개발사만)
```

- **의뢰인은 `in_progress` / `client_done` / `blocked` 로만 변경 가능**
- `verified` / `skipped` 는 개발사만. RLS `WITH CHECK`로 DB 레벨에서 강제
  (화면에서 버튼을 감추는 것만으로는 막히지 않는다)
- 진행률 = `(verified × 1.0 + client_done × 0.5) / 필수 단계 수`
- `client_done`과 `verified`를 절대 하나로 합치지 않는다 —
  "초대했다"와 "실제로 초대됐다"는 다른 사실이다

### 의뢰인 쓰기 허용 범위 (그 외 전부 읽기 전용)

| 대상 | 허용 |
|---|---|
| `project_steps` | status → in_progress / client_done / blocked 만 |
| `intake_responses` | answers 갱신 |
| `comments` | INSERT + 자기 글 soft delete |
| `deliverables` | status → approved 만 |

---

## 11. 검증 API 규칙

- 결과는 **3상태**: `verified` / `not_found` / `error`
- `error` 시 원인 메시지를 `verify_result.error`에 저장하고 화면에 그대로 노출
- **절대 `error`를 `not_found`로 뭉뚱그리지 않는다** —
  토큰 만료를 "의뢰인이 아직 안 함"으로 오인하면 서로 다른 얘기를 하게 된다
- 모든 검증 실행은 `audit_logs`에 기록

| verify_type | API | 판정 |
|---|---|---|
| `github_member` | `GET /orgs/{org}/memberships/{username}` | `state === 'active'` |
| `vercel_member` | `GET /v2/teams/{teamId}/members` | 개발사 uid 포함 |
| `supabase_member` | `GET /v1/organizations/{slug}/members` | 개발사 이메일 포함 |
| `dns` | DNS CNAME/A 조회 또는 Vercel Domains API | Vercel을 가리킴 |

---

## 12. 반응형 정책

- 브레이크포인트: `~640px` / `640~1024px` / `1024px+`
- `/p` 전 화면 모바일 완전 대응. 단계 체크 버튼은 하단 sticky
- `/app`은 PC 우선. 단 프로젝트 목록·코멘트 답글은 모바일 동작 필요
- Chrome DevTools 4G throttling으로 `/p` 홈 검증

---

## 13. 접근성

WCAG 2.1 AA 목표. 모든 인터랙티브 요소 키보드 접근, 폼에 label 또는 aria-label,
색상 대비 4.5:1 이상.

---

## 14. 성능 예산

LCP < 2.5s · CLS < 0.1 · 첫 페이지 JS 번들 < 200KB(gzip) · 이미지는 next/image

---

## 15. 테스트 정책 (MVP)

- 단위(Vitest): 진행률 계산, 상태 전이 가드, 비용 계산
- E2E(Playwright): 초대 → 매직링크 → 단계 체크 → 검증 1회전
- **RLS 테스트 필수**: 타 프로젝트·타 에이전시 데이터 접근이 차단되는지
- CI: lint + typecheck + test

---

## 16. Git — Conventional Commits

`feat` / `fix` / `refactor` / `style` / `docs` / `test` / `chore`

---

## 17. 코드 리뷰 체크리스트

- [ ] RLS 정책이 있는가? 타 프로젝트 접근이 차단되는가?
- [ ] 서버에서 권한을 재확인하는가? (클라이언트 hide만으로 끝내지 않았는지)
- [ ] `/p` 화면이 모바일에서 정상인가?
- [ ] 문구가 `ko.ts`에 있는가?
- [ ] 에러·로딩·빈 상태 UI가 있는가?
- [ ] `audit_logs` 기록이 필요한 동작인가?
- [ ] 외부 API 호출에 try/catch + 사용자 메시지가 있는가?
- [ ] 상태 전이를 건드린다면 `WITH CHECK` 가드가 있는가?

---

## 18. 절대 금지 (Hard NO)

1. `localStorage` / `sessionStorage` 사용
2. Supabase 서울 외 리전
3. `service_role` 키 클라이언트 노출
4. RLS 없는 테이블
5. 의뢰인이 `verified` 상태를 쓸 수 있는 정책
6. `project_steps`가 `onboarding_template_steps`를 FK 참조
7. `cost_rates` 값을 코드에 하드코딩
8. `any` 타입
9. `useEffect` + `fetch` (Server Component 사용)
10. 컴포넌트에 한국어 문자열 직접 삽입
11. Storage public 버킷
12. 검증 `error`를 `not_found`로 처리

---

## 19. 항상 해야 할 것

1. 새 테이블 → 같은 마이그레이션에 RLS 정책
2. 새 폼 → Zod 스키마
3. 새 문구 → `ko.ts`
4. 상태 변경 → `audit_logs`
5. 외부 API → try/catch + 3상태 결과
6. 새 화면 → 모바일 확인 (특히 `/p`)
7. 환경변수 추가 → `.env.example` 동기화
8. 작업 완료 → 17번 체크리스트

---

## 20. 라이브러리 매핑 (재검토 금지)

| 용도 | 라이브러리 |
|---|---|
| 폼 | React Hook Form + Zod |
| UI | shadcn/ui |
| 아이콘 | lucide-react |
| 날짜 | date-fns |
| 차트 | recharts |
| 마크다운 | react-markdown + rehype-sanitize |
| 메일 | Resend + React Email |
| 테스트 | Vitest + Playwright |

---

## 21. 자주 빠지는 함정

- Supabase 미들웨어 미설정 → 세션 불일치
- RLS 헬퍼 함수에 `search_path` 미고정 → 보안 취약
- 매직링크 만료가 짧음 → 24시간으로 연장
- Resend 도메인 미인증(SPF·DKIM·DMARC) → 초대 메일이 스팸함으로
- 템플릿을 FK로 연결 → 템플릿 수정 시 과거 프로젝트 기록이 변조됨
- 진행률에 `client_done`을 100%로 계산 → 검증이 무의미해짐
- Storage 서명 URL을 클라이언트에서 생성 시도 → 서버에서만 가능
- 조직 slug가 없는 초기 상태를 설계하지 않음 → 딥링크 화면이 깨짐

---

## 22. 작업 시작 전 항상 확인

1. 이 작업은 설계 문서 어느 장인가?
2. `/app`(개발사)인가 `/p`(의뢰인)인가?
3. 의뢰인도 접근하는가? 그렇다면 RLS는?
4. 새 테이블·컬럼인가? 마이그레이션이 필요한가?
5. 상태 전이를 건드리는가? `WITH CHECK` 가드가 있는가?
6. `audit_logs` 기록이 필요한가?
7. 모바일 화면도 함께 만들어야 하는가?

위 7가지가 명확하지 않으면 작업 전에 질문하거나 설계 문서를 다시 참조한다.
