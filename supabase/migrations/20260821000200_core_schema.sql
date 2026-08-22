-- ─────────────────────────────────────────────────────────────
-- 온보딩 허브 코어 스키마 — 18개 테이블 (+ consents)
-- 설계 문서 10.1 / 10.3
--
-- CLAUDE.md §8: 테이블을 만드는 마이그레이션에서 RLS를 함께 켠다.
-- 이 파일은 모든 테이블에 `enable row level security`를 건다 —
-- 정책이 하나도 없는 상태가 곧 전면 차단(deny by default)이므로,
-- 정책 파일이 적용되기 전에도 데이터가 노출되는 창이 존재하지 않는다.
-- 개별 정책은 20260821000300_rls_policies.sql 에 있다.
-- ─────────────────────────────────────────────────────────────

-- 1. agencies — 테넌트 루트
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'internal',
  seats_limit int,
  invite_contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint agencies_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
alter table public.agencies enable row level security;
select public.attach_updated_at('agencies');

-- 2. agency_members — 개발사 멤버
create table public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  display_name text,
  notification_opt_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agency_members_role_check check (role in ('owner', 'admin', 'member')),
  constraint agency_members_unique unique (agency_id, user_id)
);
alter table public.agency_members enable row level security;
select public.attach_updated_at('agency_members');
create index agency_members_user_id_idx on public.agency_members (user_id);
create index agency_members_agency_id_idx on public.agency_members (agency_id);

-- 3. clients — 의뢰인 회사
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  name text not null,
  business_no text,
  contact_name text,
  contact_email text,
  contact_phone text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.clients enable row level security;
select public.attach_updated_at('clients');
create index clients_agency_id_idx on public.clients (agency_id);

-- 4. client_members — 의뢰인 멤버 (N:M)
create table public.client_members (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  display_name text,
  phone text,
  notification_opt_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_members_role_check check (role in ('owner', 'member')),
  constraint client_members_unique unique (client_id, user_id)
);
alter table public.client_members enable row level security;
select public.attach_updated_at('client_members');
create index client_members_user_id_idx on public.client_members (user_id);
create index client_members_client_id_idx on public.client_members (client_id);

-- 5. projects — 의뢰 사안. 모든 것이 여기에 귀속된다
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  code text not null unique,
  name text not null,
  status text not null default 'onboarding',
  github_org text,
  vercel_team_slug text,
  supabase_org_slug text,
  primary_domain text,
  started_at timestamptz,
  target_launch_at timestamptz,
  delivered_at timestamptz,
  last_client_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- code는 URL에 노출된다. 영문 kebab-case만 (한국어 slug 금지)
  constraint projects_code_format check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint projects_status_check check (status in ('onboarding', 'building', 'delivered', 'archived', 'on_hold'))
);
alter table public.projects enable row level security;
select public.attach_updated_at('projects');
create index projects_agency_status_idx on public.projects (agency_id, status);
create index projects_client_id_idx on public.projects (client_id);

-- 6. project_members — 프로젝트 배정
create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  side text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_members_side_check check (side in ('agency', 'client')),
  constraint project_members_unique unique (project_id, user_id)
);
alter table public.project_members enable row level security;
select public.attach_updated_at('project_members');
create index project_members_project_id_idx on public.project_members (project_id);
create index project_members_user_id_idx on public.project_members (user_id);

-- 7. onboarding_templates — 단계 템플릿
create table public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.onboarding_templates enable row level security;
select public.attach_updated_at('onboarding_templates');
create index onboarding_templates_agency_id_idx on public.onboarding_templates (agency_id);

-- 8. onboarding_template_steps — 템플릿 단계 정의
create table public.onboarding_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_templates(id) on delete cascade,
  order_index int not null,
  key text not null,
  title text not null,
  description_md text not null default '',
  owner_side text not null default 'client',
  verify_type text not null default 'manual',
  est_minutes int,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_steps_owner_side_check check (owner_side in ('client', 'agency', 'both')),
  constraint template_steps_verify_type_check
    check (verify_type in ('manual', 'github_member', 'vercel_member', 'supabase_member', 'dns')),
  constraint template_steps_key_format check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint template_steps_unique_key unique (template_id, key)
);
alter table public.onboarding_template_steps enable row level security;
select public.attach_updated_at('onboarding_template_steps');
create index template_steps_template_order_idx on public.onboarding_template_steps (template_id, order_index);

-- 9. project_steps — 실제 단계.
--    설계 문서 2.2: 템플릿에서 «복사»된다. FK로 참조하지 않는다.
--    template_step_key는 추적용 문자열일 뿐 외래 키가 아니다.
create table public.project_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  order_index int not null,
  key text not null,
  template_step_key text,
  title text not null,
  description_md text not null default '',
  owner_side text not null default 'client',
  verify_type text not null default 'manual',
  est_minutes int,
  is_required boolean not null default true,
  status text not null default 'pending',
  blocked_reason text,
  client_done_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  verify_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_steps_owner_side_check check (owner_side in ('client', 'agency', 'both')),
  constraint project_steps_verify_type_check
    check (verify_type in ('manual', 'github_member', 'vercel_member', 'supabase_member', 'dns')),
  constraint project_steps_status_check
    check (status in ('pending', 'in_progress', 'client_done', 'verified', 'blocked', 'skipped')),
  -- blocked_reason 없이 blocked로 갈 수 없다 (설계 문서 2.2.2)
  constraint project_steps_blocked_needs_reason
    check (status <> 'blocked' or (blocked_reason is not null and length(btrim(blocked_reason)) > 0)),
  constraint project_steps_unique_key unique (project_id, key)
);
alter table public.project_steps enable row level security;
select public.attach_updated_at('project_steps');
create index project_steps_project_order_idx on public.project_steps (project_id, order_index);
create index project_steps_verify_result_gin on public.project_steps using gin (verify_result);

-- 10. intake_forms — 문답 스키마 (버전)
create table public.intake_forms (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  version text not null,
  schema jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intake_forms_unique_version unique (agency_id, version)
);
alter table public.intake_forms enable row level security;
select public.attach_updated_at('intake_forms');
create index intake_forms_schema_gin on public.intake_forms using gin (schema);

-- 11. intake_responses — 의뢰인 답변
create table public.intake_responses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  form_id uuid not null references public.intake_forms(id) on delete restrict,
  answers jsonb not null default '{}'::jsonb,
  agency_notes jsonb not null default '{}'::jsonb,
  progress_pct int not null default 0,
  last_stage_key text,
  submitted_at timestamptz,
  unlocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intake_responses_progress_range check (progress_pct between 0 and 100),
  constraint intake_responses_unique_project unique (project_id)
);
alter table public.intake_responses enable row level security;
select public.attach_updated_at('intake_responses');
create index intake_responses_answers_gin on public.intake_responses using gin (answers);
create index intake_responses_notes_gin on public.intake_responses using gin (agency_notes);

-- 12. deliverables — 산출물
create table public.deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null,
  title text not null,
  description text,
  url text,
  storage_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  version text,
  status text not null default 'draft',
  shared_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint deliverables_kind_check check (kind in ('link', 'file')),
  constraint deliverables_status_check check (status in ('draft', 'shared', 'approved')),
  constraint deliverables_payload_check check (
    (kind = 'link' and url is not null) or (kind = 'file' and storage_path is not null)
  )
);
alter table public.deliverables enable row level security;
select public.attach_updated_at('deliverables');
create index deliverables_project_id_idx on public.deliverables (project_id, created_at desc);

-- 13. comments — 다형 코멘트
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  subject_type text not null,
  subject_id uuid,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  -- author_side는 서버에서 강제 결정한다 (설계 문서 10.4.1)
  author_side text not null,
  body_md text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint comments_subject_type_check check (subject_type in ('project', 'step', 'deliverable', 'intake')),
  constraint comments_author_side_check check (author_side in ('agency', 'client')),
  constraint comments_body_not_empty check (length(btrim(body_md)) > 0)
);
alter table public.comments enable row level security;
select public.attach_updated_at('comments');
create index comments_subject_idx on public.comments (project_id, subject_type, subject_id, created_at);
create index comments_author_idx on public.comments (author_user_id);

-- 14. project_invites — 초대 토큰 (원문 저장 금지, 해시만)
create table public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_invites_role_check check (role in ('owner', 'member'))
);
alter table public.project_invites enable row level security;
select public.attach_updated_at('project_invites');
create index project_invites_project_id_idx on public.project_invites (project_id);
create index project_invites_email_idx on public.project_invites (lower(email));

-- 15. notifications — 알림 발송 이력
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  to_email text not null,
  type text not null,
  channel text not null default 'email',
  subject text,
  threshold_days int,
  sent_at timestamptz,
  error text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_channel_check check (channel in ('email'))
);
alter table public.notifications enable row level security;
select public.attach_updated_at('notifications');
create index notifications_project_type_idx on public.notifications (project_id, type, created_at desc);
create index notifications_meta_gin on public.notifications using gin (meta);

-- 16. cost_rates — 요율 마스터. 코드에 하드코딩 금지 (설계 문서 2.5)
create table public.cost_rates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  service text not null,
  plan text not null,
  item_key text not null,
  label text not null,
  unit text not null,
  included_qty numeric not null default 0,
  unit_price_usd numeric not null default 0,
  fixed_price_usd numeric not null default 0,
  effective_from date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cost_rates_service_check check (service in ('vercel', 'supabase', 'domain', 'resend')),
  constraint cost_rates_unique_item unique (agency_id, service, plan, item_key, effective_from)
);
alter table public.cost_rates enable row level security;
select public.attach_updated_at('cost_rates');
create index cost_rates_lookup_idx on public.cost_rates (agency_id, service, effective_from desc);

-- 17. cost_estimates — 견적 스냅샷. 사용한 요율 버전을 함께 기록한다
create table public.cost_estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  inputs jsonb not null,
  breakdown jsonb not null,
  monthly_total_usd numeric not null,
  monthly_total_krw numeric not null,
  usd_krw_rate numeric not null,
  rates_effective_from date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cost_estimates enable row level security;
select public.attach_updated_at('cost_estimates');
create index cost_estimates_project_idx on public.cost_estimates (project_id, created_at desc);
create index cost_estimates_inputs_gin on public.cost_estimates using gin (inputs);
create index cost_estimates_breakdown_gin on public.cost_estimates using gin (breakdown);

-- 18. audit_logs — INSERT only (설계 문서 7.4)
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_side text,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audit_logs_actor_side_check check (actor_side is null or actor_side in ('agency', 'client', 'system'))
);
alter table public.audit_logs enable row level security;
create index audit_logs_project_created_idx on public.audit_logs (project_id, created_at desc);
create index audit_logs_meta_gin on public.audit_logs using gin (meta);
-- audit_logs에는 updated_at 트리거를 붙이지 않는다 — 기록은 불변이다

-- (+) consents — 동의 이력. INSERT only (설계 문서 14.2)
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null,
  version text not null,
  agreed boolean not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consents_kind_check check (kind in ('age14', 'terms', 'privacy', 'processing_delegation'))
);
alter table public.consents enable row level security;
create index consents_email_idx on public.consents (lower(email), created_at desc);
create index consents_project_idx on public.consents (project_id);
