-- ─────────────────────────────────────────────────────────────
-- 로컬 검증용 Supabase 근사 환경
--
-- 마이그레이션과 RLS 테스트를 «실제 Postgres에서» 돌려보기 위한 최소 뼈대다.
-- Supabase가 기본 제공하는 것 중 이 프로젝트가 의존하는 부분만 만든다.
-- 운영 DB에는 적용하지 않는다 (Supabase가 이미 갖고 있다).
--
-- 사용:
--   psql ... -f supabase/tests/local-bootstrap.sql
--   psql ... -f supabase/migrations/*.sql
--   psql ... -f supabase/tests/rls.sql
-- ─────────────────────────────────────────────────────────────
create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

-- auth.users — 실제 스키마의 부분 집합
create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- auth.uid() — JWT 클레임에서 sub를 읽는다 (Supabase와 동일한 방식)
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

-- storage — 버킷·오브젝트·경로 헬퍼
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  parts := string_to_array(name, '/');
  return parts[1:array_length(parts, 1) - 1];
end;
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;
