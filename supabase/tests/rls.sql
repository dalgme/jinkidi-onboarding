-- ─────────────────────────────────────────────────────────────
-- RLS 검증 SQL — 단계 6의 완료 조건
--
-- 실행:  psql "$DATABASE_URL" -f supabase/tests/rls.sql
-- 모든 블록이 NOTICE 없이 통과하면 성공. 실패 시 exception으로 중단된다.
--
-- 검증 대상
--   1. A사 의뢰인이 B사 프로젝트를 select 하면 0행
--   2. 의뢰인이 status='verified'로 update 하면 실패
--   3. 의뢰인이 owner_side='agency' 단계를 건드리면 실패
--   4. 의뢰인이 단계 제목을 바꾸면 실패
--   5. audit_logs UPDATE·DELETE 실패
--   6. 의뢰인이 draft 산출물을 볼 수 없음
--   7. 의뢰인이 개발사 명의(author_side='agency')로 코멘트를 달 수 없음
-- ─────────────────────────────────────────────────────────────
begin;

-- ── 픽스처 ────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-4111-a111-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'agency@test.local', '', now(), now(), now()),
  ('11111111-1111-4111-a111-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-a@test.local', '', now(), now(), now()),
  ('11111111-1111-4111-a111-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-b@test.local', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.agencies (id, name, slug) values
  ('22222222-2222-4222-a222-000000000001', 'Test Agency', 'test-agency')
on conflict (id) do nothing;

insert into public.agency_members (agency_id, user_id, role) values
  ('22222222-2222-4222-a222-000000000001', '11111111-1111-4111-a111-000000000001', 'owner')
on conflict do nothing;

insert into public.clients (id, agency_id, name) values
  ('33333333-3333-4333-a333-00000000000a', '22222222-2222-4222-a222-000000000001', 'Client A'),
  ('33333333-3333-4333-a333-00000000000b', '22222222-2222-4222-a222-000000000001', 'Client B')
on conflict (id) do nothing;

insert into public.client_members (client_id, user_id, role) values
  ('33333333-3333-4333-a333-00000000000a', '11111111-1111-4111-a111-000000000002', 'owner'),
  ('33333333-3333-4333-a333-00000000000b', '11111111-1111-4111-a111-000000000003', 'owner')
on conflict do nothing;

insert into public.projects (id, agency_id, client_id, code, name) values
  ('44444444-4444-4444-a444-00000000000a', '22222222-2222-4222-a222-000000000001', '33333333-3333-4333-a333-00000000000a', 'proj-a', 'Project A'),
  ('44444444-4444-4444-a444-00000000000b', '22222222-2222-4222-a222-000000000001', '33333333-3333-4333-a333-00000000000b', 'proj-b', 'Project B')
on conflict (id) do nothing;

insert into public.project_steps (id, project_id, order_index, key, title, owner_side, verify_type) values
  ('55555555-5555-4555-a555-00000000000a', '44444444-4444-4444-a444-00000000000a', 1, 'github', 'GitHub', 'client', 'github_member'),
  ('55555555-5555-4555-a555-00000000000c', '44444444-4444-4444-a444-00000000000a', 2, 'architecture', 'Architecture', 'agency', 'manual'),
  ('55555555-5555-4555-a555-00000000000b', '44444444-4444-4444-a444-00000000000b', 1, 'github', 'GitHub', 'client', 'github_member')
on conflict (id) do nothing;

insert into public.deliverables (id, project_id, kind, title, url, status) values
  ('66666666-6666-4666-a666-00000000000a', '44444444-4444-4444-a444-00000000000a', 'link', 'Draft only', 'https://example.com', 'draft')
on conflict (id) do nothing;

insert into public.audit_logs (id, agency_id, project_id, action) values
  ('77777777-7777-4777-a777-00000000000a', '22222222-2222-4222-a222-000000000001', '44444444-4444-4444-a444-00000000000a', 'test.seed')
on conflict (id) do nothing;

-- ── 의뢰인 A로 전환 ──────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-a111-000000000002","role":"authenticated"}';

-- 1. 타 프로젝트(B) 접근 차단
do $$
declare n int;
begin
  select count(*) into n from public.projects where code = 'proj-b';
  if n <> 0 then
    raise exception 'FAIL 1: client A can see project B (% rows)', n;
  end if;

  select count(*) into n from public.projects where code = 'proj-a';
  if n <> 1 then
    raise exception 'FAIL 1b: client A cannot see own project (% rows)', n;
  end if;

  select count(*) into n from public.project_steps
   where project_id = '44444444-4444-4444-a444-00000000000b';
  if n <> 0 then
    raise exception 'FAIL 1c: client A can see project B steps (% rows)', n;
  end if;

  raise notice 'PASS 1: cross-project isolation';
end;
$$;

-- 2. 의뢰인의 verified 승격 차단 — 이 프로젝트에서 가장 중요한 가드
do $$
declare ok boolean := false;
begin
  begin
    update public.project_steps
       set status = 'verified'
     where id = '55555555-5555-4555-a555-00000000000a';
    if found then
      raise exception 'FAIL 2: client escalated a step to verified';
    end if;
    ok := true;  -- 0행 갱신도 차단으로 본다
  exception
    when insufficient_privilege or check_violation then ok := true;
    when others then
      if sqlerrm like 'FAIL 2%' then raise; end if;
      ok := true;
  end;
  if not ok then raise exception 'FAIL 2: unexpected'; end if;
  if exists (select 1 from public.project_steps
              where id = '55555555-5555-4555-a555-00000000000a' and status = 'verified') then
    raise exception 'FAIL 2: step is verified after client update';
  end if;
  raise notice 'PASS 2: client cannot set verified';
end;
$$;

-- 2b. 허용된 전이는 통과해야 한다
do $$
begin
  update public.project_steps
     set status = 'client_done', client_done_at = now()
   where id = '55555555-5555-4555-a555-00000000000a';
  if not exists (select 1 from public.project_steps
                  where id = '55555555-5555-4555-a555-00000000000a' and status = 'client_done') then
    raise exception 'FAIL 2b: client cannot mark client_done';
  end if;
  raise notice 'PASS 2b: client can mark client_done';
end;
$$;

-- 3. 개발사 담당 단계는 의뢰인이 건드릴 수 없다
do $$
begin
  update public.project_steps
     set status = 'in_progress'
   where id = '55555555-5555-4555-a555-00000000000c';
  if exists (select 1 from public.project_steps
              where id = '55555555-5555-4555-a555-00000000000c' and status = 'in_progress') then
    raise exception 'FAIL 3: client changed an agency-owned step';
  end if;
  raise notice 'PASS 3: agency-owned step protected';
end;
$$;

-- 4. 의뢰인은 status 외 컬럼을 바꿀 수 없다 (트리거)
do $$
declare blocked boolean := false;
begin
  begin
    update public.project_steps
       set title = 'hijacked'
     where id = '55555555-5555-4555-a555-00000000000a';
  exception when others then blocked := true;
  end;
  if not blocked and exists (select 1 from public.project_steps
                              where id = '55555555-5555-4555-a555-00000000000a' and title = 'hijacked') then
    raise exception 'FAIL 4: client rewrote step content';
  end if;
  raise notice 'PASS 4: step content immutable for client';
end;
$$;

-- 5. audit_logs는 append-only
do $$
declare blocked boolean := false;
begin
  begin
    update public.audit_logs set action = 'tampered'
     where id = '77777777-7777-4777-a777-00000000000a';
  exception when others then blocked := true;
  end;
  if not blocked and exists (select 1 from public.audit_logs
                              where id = '77777777-7777-4777-a777-00000000000a' and action = 'tampered') then
    raise exception 'FAIL 5: audit log was mutated';
  end if;

  blocked := false;
  begin
    delete from public.audit_logs where id = '77777777-7777-4777-a777-00000000000a';
  exception when others then blocked := true;
  end;
  /*
   * 여기서 「행이 남아 있는지」를 의뢰인 세션으로 확인할 수는 없다.
   * client_visible = false인 감사 로그는 애초에 의뢰인에게 «보이지 않기» 때문에
   * 삭제되지 않았어도 select가 0행을 준다.
   * 실제 잔존 여부는 아래 10번에서 권한을 되돌린 뒤 확인한다.
   */
  raise notice 'PASS 5: audit_logs update/delete rejected for client';
end;
$$;

-- 6. draft 산출물은 의뢰인에게 보이지 않는다
do $$
declare n int;
begin
  select count(*) into n from public.deliverables
   where id = '66666666-6666-4666-a666-00000000000a';
  if n <> 0 then
    raise exception 'FAIL 6: client can see a draft deliverable';
  end if;
  raise notice 'PASS 6: draft deliverables hidden';
end;
$$;

-- 7. 의뢰인이 개발사 명의로 코멘트를 달 수 없다 (트리거가 author_side를 덮어쓴다)
do $$
declare side text;
begin
  insert into public.comments (project_id, subject_type, subject_id, author_user_id, author_side, body_md)
  values ('44444444-4444-4444-a444-00000000000a', 'project', null,
          '11111111-1111-4111-a111-000000000001', 'agency', 'spoofed');

  select author_side into side from public.comments
   where project_id = '44444444-4444-4444-a444-00000000000a' and body_md = 'spoofed';
  if side <> 'client' then
    raise exception 'FAIL 7: author_side was trusted from the client (got %)', side;
  end if;
  if not exists (select 1 from public.comments
                  where body_md = 'spoofed' and author_user_id = '11111111-1111-4111-a111-000000000002') then
    raise exception 'FAIL 7b: author_user_id was trusted from the client';
  end if;
  raise notice 'PASS 7: author_side forced server-side';
end;
$$;

-- ── 의뢰인 B로 전환: 반대 방향도 확인 ────────────────────────
set local request.jwt.claims = '{"sub":"11111111-1111-4111-a111-000000000003","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.projects where code = 'proj-a';
  if n <> 0 then
    raise exception 'FAIL 8: client B can see project A';
  end if;
  raise notice 'PASS 8: reverse isolation';
end;
$$;

-- ── 개발사로 전환: 정당한 권한은 살아 있어야 한다 ────────────
set local request.jwt.claims = '{"sub":"11111111-1111-4111-a111-000000000001","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.projects where code in ('proj-a', 'proj-b');
  if n <> 2 then
    raise exception 'FAIL 9: agency cannot see its own projects (% of 2)', n;
  end if;

  update public.project_steps set status = 'verified', verified_at = now()
   where id = '55555555-5555-4555-a555-00000000000a';
  if not exists (select 1 from public.project_steps
                  where id = '55555555-5555-4555-a555-00000000000a' and status = 'verified') then
    raise exception 'FAIL 9b: agency cannot verify a step';
  end if;
  raise notice 'PASS 9: agency retains full access';
end;
$$;

-- 10. 불변성이 외래 키 참조 동작까지 막지는 않아야 한다.
--     (20260821000500 마이그레이션이 고친 문제 — 트리거로 막으면 여기서 실패한다)
reset role;
select set_config('request.jwt.claims', '', true);
do $$
begin
  -- 5번에서 의뢰인이 시도한 UPDATE·DELETE가 실제로 반영되지 않았어야 한다
  if not exists (
    select 1 from public.audit_logs
     where id = '77777777-7777-4777-a777-00000000000a' and action = 'test.seed'
  ) then
    raise exception 'FAIL 10a: audit log was mutated or deleted by a client';
  end if;

  -- 그러면서도 감사 로그가 달린 프로젝트는 지울 수 있어야 한다 (ON DELETE CASCADE)
  delete from public.projects where id = '44444444-4444-4444-a444-00000000000a';
  if exists (select 1 from public.projects where id = '44444444-4444-4444-a444-00000000000a') then
    raise exception 'FAIL 10: project with audit logs could not be deleted';
  end if;
  raise notice 'PASS 10: FK cascade still works with append-only tables';
end;
$$;

rollback;
