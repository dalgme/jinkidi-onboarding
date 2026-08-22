-- ─────────────────────────────────────────────────────────────
-- RLS 헬퍼 함수 + 전 테이블 정책
-- 설계 문서 10.4 / CLAUDE.md §8·§10
--
-- 여기가 뚫리면 A사 의뢰인이 B사 프로젝트를 본다.
-- 정책을 테이블마다 손으로 쓰지 말고 헬퍼 함수를 일관되게 경유한다.
-- 모든 헬퍼는 security definer + set search_path = public (미고정 시 보안 취약)
-- ─────────────────────────────────────────────────────────────

-- 소속 개발사 id 집합
create or replace function public.my_agency_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select agency_id from agency_members where user_id = auth.uid()
$$;

-- 접근 가능한 프로젝트 id 집합 — 개발사(소속 agency 전 프로젝트) ∪ 의뢰인(소속 client 프로젝트)
create or replace function public.my_project_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.id
    from projects p
   where p.agency_id in (select agency_id from agency_members where user_id = auth.uid())
  union
  select p.id
    from projects p
    join client_members cm on cm.client_id = p.client_id
   where cm.user_id = auth.uid()
$$;

-- 개발사로서 쓰기 가능한 프로젝트 id 집합 (의뢰인 소속은 제외)
create or replace function public.my_agency_project_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.id
    from projects p
   where p.agency_id in (select agency_id from agency_members where user_id = auth.uid())
$$;

-- 특정 프로젝트에서 나의 side. 양쪽 모두면 agency 우선 (개발사 화면이 상위 권한)
create or replace function public.my_side_for_project(target_project_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when exists (
      select 1 from projects p
        join agency_members am on am.agency_id = p.agency_id
       where p.id = target_project_id and am.user_id = auth.uid()
    ) then 'agency'
    when exists (
      select 1 from projects p
        join client_members cm on cm.client_id = p.client_id
       where p.id = target_project_id and cm.user_id = auth.uid()
    ) then 'client'
    else null
  end
$$;

-- agency 내 역할이 admin 이상인 agency id 집합 (템플릿·요율 관리용)
create or replace function public.my_admin_agency_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select agency_id from agency_members
   where user_id = auth.uid() and role in ('owner', 'admin')
$$;

create or replace function public.my_owner_agency_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select agency_id from agency_members
   where user_id = auth.uid() and role = 'owner'
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. agencies
-- ─────────────────────────────────────────────────────────────
create policy agencies_select on public.agencies for select to authenticated
  using (
    id in (select public.my_agency_ids())
    -- 의뢰인도 자기 프로젝트를 맡은 개발사 정보는 볼 수 있어야 한다 (포털 헤더·메일 발신자명)
    or exists (
      select 1 from public.projects p
        join public.client_members cm on cm.client_id = p.client_id
       where p.agency_id = agencies.id and cm.user_id = auth.uid()
    )
  );

create policy agencies_update on public.agencies for update to authenticated
  using (id in (select public.my_owner_agency_ids()))
  with check (id in (select public.my_owner_agency_ids()));

-- ─────────────────────────────────────────────────────────────
-- 2. agency_members
-- ─────────────────────────────────────────────────────────────
create policy agency_members_select on public.agency_members for select to authenticated
  using (agency_id in (select public.my_agency_ids()));

create policy agency_members_write on public.agency_members for all to authenticated
  using (agency_id in (select public.my_owner_agency_ids()))
  with check (agency_id in (select public.my_owner_agency_ids()));

-- 본인 알림 설정은 스스로 변경 가능
create policy agency_members_self_update on public.agency_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 3. clients
-- ─────────────────────────────────────────────────────────────
create policy clients_select on public.clients for select to authenticated
  using (
    agency_id in (select public.my_agency_ids())
    or id in (select client_id from public.client_members where user_id = auth.uid())
  );

create policy clients_write on public.clients for all to authenticated
  using (agency_id in (select public.my_agency_ids()))
  with check (agency_id in (select public.my_agency_ids()));

-- ─────────────────────────────────────────────────────────────
-- 4. client_members
-- ─────────────────────────────────────────────────────────────
create policy client_members_select on public.client_members for select to authenticated
  using (
    client_id in (
      select c.id from public.clients c where c.agency_id in (select public.my_agency_ids())
    )
    or client_id in (select client_id from public.client_members cm where cm.user_id = auth.uid())
  );

create policy client_members_agency_write on public.client_members for all to authenticated
  using (
    client_id in (
      select c.id from public.clients c where c.agency_id in (select public.my_agency_ids())
    )
  )
  with check (
    client_id in (
      select c.id from public.clients c where c.agency_id in (select public.my_agency_ids())
    )
  );

create policy client_members_self_update on public.client_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 5. projects — 의뢰인은 읽기 전용
-- ─────────────────────────────────────────────────────────────
create policy projects_select on public.projects for select to authenticated
  using (id in (select public.my_project_ids()));

create policy projects_write on public.projects for all to authenticated
  using (agency_id in (select public.my_agency_ids()))
  with check (agency_id in (select public.my_agency_ids()));

-- ─────────────────────────────────────────────────────────────
-- 6. project_members
-- ─────────────────────────────────────────────────────────────
create policy project_members_select on public.project_members for select to authenticated
  using (project_id in (select public.my_project_ids()));

create policy project_members_write on public.project_members for all to authenticated
  using (project_id in (select public.my_agency_project_ids()))
  with check (project_id in (select public.my_agency_project_ids()));

-- ─────────────────────────────────────────────────────────────
-- 7·8. onboarding_templates / onboarding_template_steps — 개발사 전용
-- ─────────────────────────────────────────────────────────────
create policy templates_select on public.onboarding_templates for select to authenticated
  using (agency_id in (select public.my_agency_ids()));

create policy templates_write on public.onboarding_templates for all to authenticated
  using (agency_id in (select public.my_admin_agency_ids()))
  with check (agency_id in (select public.my_admin_agency_ids()));

create policy template_steps_select on public.onboarding_template_steps for select to authenticated
  using (
    template_id in (
      select t.id from public.onboarding_templates t
       where t.agency_id in (select public.my_agency_ids())
    )
  );

create policy template_steps_write on public.onboarding_template_steps for all to authenticated
  using (
    template_id in (
      select t.id from public.onboarding_templates t
       where t.agency_id in (select public.my_admin_agency_ids())
    )
  )
  with check (
    template_id in (
      select t.id from public.onboarding_templates t
       where t.agency_id in (select public.my_admin_agency_ids())
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 9. project_steps — 이 프로젝트에서 가장 중요한 정책
--
-- 의뢰인은 status를 in_progress / client_done / blocked 로만 바꿀 수 있다.
-- verified·skipped 는 개발사만. 화면에서 버튼을 감추는 것으로는 막히지 않는다 —
-- 개발자 도구로 API를 직접 호출하면 그대로 통과하기 때문에 WITH CHECK로 막는다.
-- ─────────────────────────────────────────────────────────────
create policy project_steps_select on public.project_steps for select to authenticated
  using (project_id in (select public.my_project_ids()));

create policy project_steps_agency_write on public.project_steps for all to authenticated
  using (project_id in (select public.my_agency_project_ids()))
  with check (project_id in (select public.my_agency_project_ids()));

create policy project_steps_client_update on public.project_steps for update to authenticated
  using (
    public.my_side_for_project(project_id) = 'client'
    and owner_side in ('client', 'both')
    -- 이미 검증·제외된 단계는 의뢰인이 되돌릴 수 없다
    and status not in ('verified', 'skipped')
  )
  with check (
    public.my_side_for_project(project_id) = 'client'
    and owner_side in ('client', 'both')
    and status in ('in_progress', 'client_done', 'blocked')
  );

-- 의뢰인이 status 이외의 컬럼(title, verified_at, verify_result ...)을 손대지 못하게 한다.
-- RLS는 행 단위라 컬럼을 구분하지 못하므로 트리거로 강제한다.
create or replace function public.enforce_step_client_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 개발사 멤버이거나 service_role(auth.uid() is null)이면 제한 없음
  if auth.uid() is null or public.my_side_for_project(new.project_id) = 'agency' then
    return new;
  end if;

  if new.project_id is distinct from old.project_id
     or new.order_index is distinct from old.order_index
     or new.key is distinct from old.key
     or new.template_step_key is distinct from old.template_step_key
     or new.title is distinct from old.title
     or new.description_md is distinct from old.description_md
     or new.owner_side is distinct from old.owner_side
     or new.verify_type is distinct from old.verify_type
     or new.est_minutes is distinct from old.est_minutes
     or new.is_required is distinct from old.is_required
     or new.verified_at is distinct from old.verified_at
     or new.verified_by is distinct from old.verified_by
     or new.verify_result is distinct from old.verify_result then
    raise exception 'client may only change step status, blocked_reason and client_done_at';
  end if;

  return new;
end;
$$;

create trigger project_steps_client_scope
  before update on public.project_steps
  for each row execute function public.enforce_step_client_update_scope();

-- ─────────────────────────────────────────────────────────────
-- 10. intake_forms — 개발사 관리, 의뢰인은 자기 프로젝트의 폼만 읽기
-- ─────────────────────────────────────────────────────────────
create policy intake_forms_select on public.intake_forms for select to authenticated
  using (
    agency_id in (select public.my_agency_ids())
    or id in (
      select r.form_id from public.intake_responses r
       where r.project_id in (select public.my_project_ids())
    )
  );

create policy intake_forms_write on public.intake_forms for all to authenticated
  using (agency_id in (select public.my_admin_agency_ids()))
  with check (agency_id in (select public.my_admin_agency_ids()));

-- ─────────────────────────────────────────────────────────────
-- 11. intake_responses — 의뢰인은 answers 갱신만
-- ─────────────────────────────────────────────────────────────
create policy intake_responses_select on public.intake_responses for select to authenticated
  using (project_id in (select public.my_project_ids()));

create policy intake_responses_agency_write on public.intake_responses for all to authenticated
  using (project_id in (select public.my_agency_project_ids()))
  with check (project_id in (select public.my_agency_project_ids()));

create policy intake_responses_client_update on public.intake_responses for update to authenticated
  using (
    public.my_side_for_project(project_id) = 'client'
    -- 제출 후에는 개발사가 잠금 해제(unlocked_at)해야 다시 쓸 수 있다
    and (submitted_at is null or unlocked_at is not null)
  )
  with check (public.my_side_for_project(project_id) = 'client');

create or replace function public.enforce_intake_client_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.my_side_for_project(new.project_id) = 'agency' then
    return new;
  end if;

  if new.project_id is distinct from old.project_id
     or new.form_id is distinct from old.form_id
     or new.agency_notes is distinct from old.agency_notes
     or new.unlocked_at is distinct from old.unlocked_at then
    raise exception 'client may only change intake answers and progress';
  end if;

  return new;
end;
$$;

create trigger intake_responses_client_scope
  before update on public.intake_responses
  for each row execute function public.enforce_intake_client_update_scope();

-- ─────────────────────────────────────────────────────────────
-- 12. deliverables — 의뢰인은 shared 이상만 보고, status를 approved 로만
-- ─────────────────────────────────────────────────────────────
create policy deliverables_select on public.deliverables for select to authenticated
  using (
    project_id in (select public.my_agency_project_ids())
    or (
      project_id in (select public.my_project_ids())
      and status in ('shared', 'approved')
      and deleted_at is null
    )
  );

create policy deliverables_agency_write on public.deliverables for all to authenticated
  using (project_id in (select public.my_agency_project_ids()))
  with check (project_id in (select public.my_agency_project_ids()));

create policy deliverables_client_approve on public.deliverables for update to authenticated
  using (
    public.my_side_for_project(project_id) = 'client'
    and status in ('shared', 'approved')
    and deleted_at is null
  )
  with check (
    public.my_side_for_project(project_id) = 'client'
    and status = 'approved'
  );

create or replace function public.enforce_deliverable_client_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.my_side_for_project(new.project_id) = 'agency' then
    return new;
  end if;

  if new.project_id is distinct from old.project_id
     or new.kind is distinct from old.kind
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.url is distinct from old.url
     or new.storage_path is distinct from old.storage_path
     or new.file_name is distinct from old.file_name
     or new.version is distinct from old.version
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'client may only approve a deliverable';
  end if;

  return new;
end;
$$;

create trigger deliverables_client_scope
  before update on public.deliverables
  for each row execute function public.enforce_deliverable_client_update_scope();

-- ─────────────────────────────────────────────────────────────
-- 13. comments — INSERT 허용 + 자기 글 soft delete
--     author_side와 author_user_id는 DB에서 강제한다 (클라이언트 값 신뢰 금지)
-- ─────────────────────────────────────────────────────────────
create policy comments_select on public.comments for select to authenticated
  using (project_id in (select public.my_project_ids()));

create policy comments_insert on public.comments for insert to authenticated
  with check (
    project_id in (select public.my_project_ids())
    and author_user_id = auth.uid()
  );

create policy comments_self_update on public.comments for update to authenticated
  using (author_user_id = auth.uid() and project_id in (select public.my_project_ids()))
  with check (author_user_id = auth.uid());

-- 개발사는 부적절한 게시물을 가릴 수 있어야 한다 (이용약관 제8조 ④)
create policy comments_agency_moderate on public.comments for update to authenticated
  using (project_id in (select public.my_agency_project_ids()))
  with check (project_id in (select public.my_agency_project_ids()));

create or replace function public.enforce_comment_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_side text;
begin
  if auth.uid() is null then
    return new;  -- service_role (시스템 코멘트)
  end if;

  resolved_side := public.my_side_for_project(new.project_id);
  if resolved_side is null then
    raise exception 'no access to project';
  end if;

  new.author_user_id := auth.uid();
  new.author_side := resolved_side;
  return new;
end;
$$;

create trigger comments_force_author
  before insert on public.comments
  for each row execute function public.enforce_comment_author();

-- 본문 수정은 허용하지 않는다. 허용 변경은 soft delete 뿐 (분쟁 시 «그런 말 한 적 없다» 방지)
create or replace function public.enforce_comment_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.body_md is distinct from old.body_md
     or new.author_user_id is distinct from old.author_user_id
     or new.author_side is distinct from old.author_side
     or new.subject_type is distinct from old.subject_type
     or new.subject_id is distinct from old.subject_id
     or new.project_id is distinct from old.project_id then
    raise exception 'comments are immutable; only soft delete is allowed';
  end if;

  return new;
end;
$$;

create trigger comments_update_scope
  before update on public.comments
  for each row execute function public.enforce_comment_update_scope();

-- ─────────────────────────────────────────────────────────────
-- 14. project_invites — 개발사 전용. 토큰 대조는 서버(service_role)에서 한다
-- ─────────────────────────────────────────────────────────────
create policy project_invites_agency_all on public.project_invites for all to authenticated
  using (project_id in (select public.my_agency_project_ids()))
  with check (project_id in (select public.my_agency_project_ids()));

-- ─────────────────────────────────────────────────────────────
-- 15. notifications — 개발사는 프로젝트 이력 열람, 본인 수신분은 본인도 열람
-- ─────────────────────────────────────────────────────────────
create policy notifications_select on public.notifications for select to authenticated
  using (
    project_id in (select public.my_agency_project_ids())
    or user_id = auth.uid()
  );
-- INSERT는 서버(service_role)만. authenticated용 INSERT 정책을 두지 않는다

-- ─────────────────────────────────────────────────────────────
-- 16. cost_rates — 읽기는 소속 전원, 수정은 owner
-- ─────────────────────────────────────────────────────────────
create policy cost_rates_select on public.cost_rates for select to authenticated
  using (
    agency_id in (select public.my_agency_ids())
    or agency_id in (
      select p.agency_id from public.projects p where p.id in (select public.my_project_ids())
    )
  );

create policy cost_rates_write on public.cost_rates for all to authenticated
  using (agency_id in (select public.my_owner_agency_ids()))
  with check (agency_id in (select public.my_owner_agency_ids()));

-- ─────────────────────────────────────────────────────────────
-- 17. cost_estimates — 의뢰인은 열람만
-- ─────────────────────────────────────────────────────────────
create policy cost_estimates_select on public.cost_estimates for select to authenticated
  using (project_id in (select public.my_project_ids()));

create policy cost_estimates_write on public.cost_estimates for all to authenticated
  using (project_id in (select public.my_agency_project_ids()))
  with check (project_id in (select public.my_agency_project_ids()));

-- ─────────────────────────────────────────────────────────────
-- 18. audit_logs — INSERT만. UPDATE·DELETE 정책은 «없다»
--     의뢰인에게는 client_visible로 표시된 항목만 보인다
-- ─────────────────────────────────────────────────────────────
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (
    project_id in (select public.my_agency_project_ids())
    or (project_id in (select public.my_project_ids()) and client_visible = true)
  );

create policy audit_logs_insert on public.audit_logs for insert to authenticated
  with check (
    project_id in (select public.my_project_ids())
    and actor_user_id = auth.uid()
  );

-- 기록 위·변조를 DB 레벨에서 막는다 (정책 부재 + 트리거 이중 방어)
create or replace function public.reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'this table is append-only';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function public.reject_mutation();

-- ─────────────────────────────────────────────────────────────
-- (+) consents — INSERT만
-- ─────────────────────────────────────────────────────────────
create policy consents_select on public.consents for select to authenticated
  using (
    user_id = auth.uid()
    or project_id in (select public.my_agency_project_ids())
  );

create policy consents_insert on public.consents for insert to authenticated
  with check (user_id = auth.uid());

create trigger consents_append_only
  before update or delete on public.consents
  for each row execute function public.reject_mutation();
