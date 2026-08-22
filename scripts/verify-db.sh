#!/usr/bin/env bash
#
# 마이그레이션과 RLS 정책을 «실제 Postgres에서» 검증한다.
#
# Supabase 프로젝트 없이도 돌아간다 — local-bootstrap.sql이 auth·storage 스키마와
# anon/authenticated/service_role 역할을 최소한으로 흉내 내기 때문이다.
# RLS는 이 프로젝트에서 가장 위험한 부분이라, 배포 전에 반드시 한 번 통과시킨다.
#
# 사용:
#   ./scripts/verify-db.sh                     # 임시 인스턴스를 띄워서 검증
#   DATABASE_URL=postgres://... ./scripts/verify-db.sh   # 기존 DB에 대고 검증
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -n "${DATABASE_URL:-}" ]]; then
  PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)
  echo "▸ 기존 DATABASE_URL에 대고 검증합니다"
else
  PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
  PGDATA="${PGDATA:-/var/tmp/onboarding-verify-pgdata}"
  PGPORT="${PGPORT:-55432}"
  PGSOCK="${PGSOCK:-/var/tmp}"
  export PATH="$PGBIN:$PATH"

  command -v initdb >/dev/null || {
    echo "postgres 바이너리를 찾을 수 없습니다. PGBIN을 지정하세요 (현재: $PGBIN)" >&2
    exit 1
  }

  # 정리 과정의 실패가 검증 결과를 덮어쓰지 않도록 원래 종료 코드를 보존한다
  cleanup() {
    local status=$?
    if [[ "$(id -u)" -eq 0 ]]; then
      su "${PGRUNAS:-nobody}" -s /bin/bash -c "PATH=$PGBIN:\$PATH pg_ctl -D $PGDATA stop -m immediate" >/dev/null 2>&1 || true
    else
      pg_ctl -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true
    fi
    rm -rf "$PGDATA" 2>/dev/null || true
    exit "$status"
  }
  trap cleanup EXIT

  echo "▸ 임시 Postgres 인스턴스를 띄웁니다 ($PGDATA)"
  rm -rf "$PGDATA"
  mkdir -p "$PGDATA"

  # Postgres는 root로 뜨지 않는다. CI 컨테이너는 대개 root이므로
  # 그 경우에만 권한 없는 사용자로 내려서 실행한다.
  RUN_AS="${PGRUNAS:-nobody}"
  if [[ "$(id -u)" -eq 0 ]]; then
    chown -R "$RUN_AS" "$PGDATA"
    run_pg() { su "$RUN_AS" -s /bin/bash -c "PATH=$PGBIN:\$PATH $*"; }
  else
    run_pg() { bash -c "$*"; }
  fi

  run_pg "initdb -D $PGDATA -U postgres --auth=trust" >/dev/null
  run_pg "pg_ctl -D $PGDATA -o '-p $PGPORT -k $PGSOCK' -l $PGDATA/log start" >/dev/null
  sleep 1

  psql -h "$PGSOCK" -p "$PGPORT" -U postgres -q -c "create database onboarding_verify;"
  PSQL=(psql -h "$PGSOCK" -p "$PGPORT" -U postgres -d onboarding_verify -v ON_ERROR_STOP=1 -q)

  echo "▸ Supabase 근사 환경 구성"
  "${PSQL[@]}" -f supabase/tests/local-bootstrap.sql
fi

echo "▸ 마이그레이션 적용"
for file in supabase/migrations/*.sql; do
  echo "   $(basename "$file")"
  "${PSQL[@]}" -f "$file"
done

echo "▸ 시드 적용"
"${PSQL[@]}" -f supabase/seed.sql

echo "▸ RLS 적용 현황"
"${PSQL[@]}" -tAc "
  select case when count(*) filter (where not c.relrowsecurity) = 0
    then '   전 테이블 RLS 활성 (' || count(*) || '개)'
    else '   ⚠ RLS 누락: ' || string_agg(c.relname, ', ') filter (where not c.relrowsecurity)
  end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';
"

echo "▸ RLS 격리 테스트"
"${PSQL[@]}" -f supabase/tests/rls.sql 2>&1 | grep -E "PASS|FAIL" | sed 's/^.*NOTICE:  /   /'

echo "▸ 완료"
