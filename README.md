# 온보딩 허브

의뢰받은 플랫폼을 처음부터 의뢰인 명의로 세우는 절차를, 의뢰인과 개발사가 같은 화면을 보며
함께 완주하는 프로젝트 단위 온보딩 채널.

> 설계 근거는 「온보딩 허브 설계 문서 v1.0」, 구현 규칙은 루트의 `CLAUDE.md`를 따른다.

## 이 도구가 강제하는 것

**계정 공유가 아니라 권한 위임.** 의뢰인이 GitHub Organization · Vercel Team ·
Supabase Organization · 도메인을 소유하고, 개발사는 자기 계정으로 멤버 초대를 받는다.
시스템 전체가 이 원칙을 강제한다 — 의뢰인은 `verified` 상태를 만들 수 없고(DB 레벨),
산출물은 private 버킷에만 올라가며, 모든 행위가 수정 불가능한 감사 로그로 남는다.

## 화면

| 경로 | 대상 | 성격 |
|---|---|---|
| `/app` | 개발사 | PC 우선, 밀도 높은 테이블 |
| `/p/[code]` | 의뢰인 | 모바일 우선, 문장형 안내 |
| `/terms`, `/privacy` | 공개 | 약관·처리방침 |

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local   # 값을 채운다
pnpm dev
```

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint
pnpm test        # Vitest 단위 테스트
pnpm test:e2e    # Playwright (환경변수 필요, 아래 참조)
pnpm build
```

## 최초 설정

### 1. Supabase

**리전은 반드시 `ap-northeast-2` (Northeast Asia, Seoul)로 만든다.**
생성 후에는 바꿀 수 없고, 국내 이용자 정보의 국외 이전을 피하려면 서울이어야 한다.
잘못 만들면 새 프로젝트를 만들어 데이터를 옮기는 수밖에 없다.

```bash
pnpm dlx supabase link --project-ref <ref>
pnpm db:push                                  # 마이그레이션 적용
psql "$DATABASE_URL" -f supabase/seed.sql     # 기본 템플릿·문답·요율 시딩
pnpm db:types                                 # src/types/database.ts 재생성
```

RLS가 실제로 막고 있는지 확인한다. **통과하지 않으면 배포하지 않는다.**

```bash
./scripts/verify-db.sh        # 임시 Postgres를 띄워 마이그레이션 + 시드 + 격리 테스트
```

Supabase 프로젝트 없이도 돌아가며 CI에서 매번 실행된다. 검사하는 것은 다음 열한 가지다.

| # | 검사 |
|---|---|
| 1 · 8 | A사 의뢰인이 B사 프로젝트를 조회하면 0행 (양방향) |
| 2 | 의뢰인이 `verified`로 올리는 것이 차단됨 |
| 2b | 의뢰인이 `client_done`으로 바꾸는 것은 정상 동작 |
| 3 | 개발사 담당 단계를 의뢰인이 못 건드림 |
| 4 | 의뢰인이 단계 제목·검증 결과를 못 고침 |
| 5 · 10a | 감사 로그를 의뢰인이 수정·삭제할 수 없음 |
| 6 | `draft` 산출물이 의뢰인에게 보이지 않음 |
| 7 | 의뢰인이 개발사 명의로 코멘트를 달 수 없음 |
| 9 | 개발사의 정당한 권한은 그대로 살아 있음 |
| 10 | 불변 테이블이 FK 참조 동작(CASCADE·SET NULL)을 막지 않음 |

기존 DB에 대고 돌리려면 `DATABASE_URL=postgres://... ./scripts/verify-db.sh`.

Dashboard에서 두 가지를 함께 설정한다.

- **Authentication → Email**: 매직링크 만료를 **24시간**으로 늘린다.
  기본값은 짧아서, 다음 날 메일을 여는 의뢰인이 매번 만료 화면을 본다.
- **Authentication → URL Configuration**: 로컬·운영 리다이렉트 URL을 모두 등록한다.

### 2. 개발사 멤버 시딩

자사 전용 도구라 회원가입 플로우가 없다. Dashboard → Authentication → Users에서
구성원을 초대한 뒤, `supabase/seed.sql` 하단의 안내대로 `agency_members`에 넣는다.

### 3. Resend

발신 도메인을 등록하고 **SPF · DKIM · DMARC를 모두 설정한다.**
이것 없이 출시하면 초대 메일 도달률이 절반 이하로 떨어지고,
의뢰인은 「메일이 안 왔다」, 개발사는 「보냈다」를 반복하게 된다.
Gmail · Naver · Outlook 세 곳으로 실제 발송을 확인한다.

개발 중에는 `MAIL_DRY_RUN=true`로 두면 실제 발송 대신 콘솔에 출력된다.

### 4. 검증 API 토큰

`.env.example`의 주석을 참고해 4종 토큰을 발급한다. 모두 서버 전용이다.
토큰이 없거나 만료되면 검증 결과가 `error`로 뜨고 화면에 원문이 그대로 노출된다 —
`not_found`(아직 안 함)와 절대 섞이지 않는다.

### 5. 배포 (Vercel)

1. 프로젝트 연결 후 환경변수 전체 등록 (Production / Preview 분리)
2. 커스텀 도메인 연결
3. **Supabase Auth의 Site URL·Redirect URL을 운영 도메인으로 갱신**
4. `vercel.json`의 크론이 실행 로그에 나타나는지 다음 날 확인

> 배포 직후 실제 이메일로 로그인을 한 바퀴 돌려본다.
> Redirect URL이 localhost로 남아 있는 실수가 매우 흔하다 —
> 이 경우 운영에서 매직링크를 눌러도 아무 일도 일어나지 않는다.

## E2E 테스트

매직링크는 메일함을 거치므로 완전 자동화가 어렵다.
공개 경로 검사는 그냥 돌아가고, 포털 시나리오는 아래 두 값이 있을 때만 실행된다.

```bash
E2E_PROJECT_CODE=<프로젝트 code> \
E2E_CLIENT_STORAGE_STATE=<의뢰인 로그인 storageState 경로> \
pnpm test:e2e
```

## 구조

```
src/
  app/(auth)/     로그인 · 매직링크 콜백 · 초대 수락
  app/(agency)/   개발사 영역
  app/(portal)/   의뢰인 영역
  app/api/        검증 · 크론 · 다운로드
  lib/onboarding/ 진행률 · 상태 전이 가드 · slug 정규화 · 딥링크 · 템플릿 복사
  lib/verify/     GitHub · Vercel · Supabase · DNS (3상태 결과)
  lib/mail/       Resend + React Email + 리마인더
  lib/cost/       고정비 계산 (요율은 DB에서만 읽는다)
  content/ko.ts   사용자 노출 문구 전부
supabase/
  migrations/     스키마 · RLS · Storage
  tests/rls.sql   격리 검증
```

## 운영 중 주의

- **요율이 바뀌면** 기존 `cost_rates` 행을 고치지 말고 새 `effective_from`으로 추가한다.
  과거 견적을 「그때 이 요율로 안내했다」로 재현할 수 있어야 한다.
- **템플릿을 고쳐도** 기존 프로젝트의 단계는 바뀌지 않는다. 복사 구조이기 때문이다.
- **리마인더는 14일에서 멈춘다.** 그 뒤에는 개발사에게 직접 연락하라는 알림이 간다.
  무한 리마인더는 스팸으로 분류되고, 한 번 분류되면 이후 중요한 메일까지 닿지 않는다.

## 라이선스

자사 전용 내부 도구.
