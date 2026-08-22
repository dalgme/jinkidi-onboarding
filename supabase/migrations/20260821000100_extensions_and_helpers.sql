-- ─────────────────────────────────────────────────────────────
-- 확장 및 공통 유틸
-- 설계 문서 10.3
-- ─────────────────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;
create extension if not exists moddatetime with schema extensions;

-- updated_at 자동 갱신 트리거를 테이블에 붙이는 헬퍼
create or replace function public.attach_updated_at(target_table text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  execute format(
    'drop trigger if exists set_updated_at on public.%I;
     create trigger set_updated_at before update on public.%I
     for each row execute procedure extensions.moddatetime(updated_at);',
    target_table, target_table
  );
end;
$$;
