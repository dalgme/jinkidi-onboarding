/**
 * DB 타입.
 *
 * 운영에서는 `pnpm db:types` (supabase gen types)로 이 파일을 덮어쓴다.
 * 여기 있는 정의는 마이그레이션과 손으로 맞춘 것으로, Supabase 프로젝트가
 * 연결되기 전에도 타입 검사가 돌아가도록 두었다.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type StepStatus = 'pending' | 'in_progress' | 'client_done' | 'verified' | 'blocked' | 'skipped'
export type OwnerSide = 'client' | 'agency' | 'both'
export type Side = 'agency' | 'client'
export type VerifyType = 'manual' | 'github_member' | 'vercel_member' | 'supabase_member' | 'dns'
export type ProjectStatus = 'onboarding' | 'building' | 'delivered' | 'archived' | 'on_hold'
export type DeliverableKind = 'link' | 'file'
export type DeliverableStatus = 'draft' | 'shared' | 'approved'
export type CommentSubjectType = 'project' | 'step' | 'deliverable' | 'intake'
export type AgencyRole = 'owner' | 'admin' | 'member'
export type ClientRole = 'owner' | 'member'
export type ConsentKind = 'age14' | 'terms' | 'privacy' | 'processing_delegation'
export type CostService = 'vercel' | 'supabase' | 'domain' | 'resend'

export interface Agency {
  id: string
  name: string
  slug: string
  plan: string
  seats_limit: number | null
  invite_contact_email: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AgencyMember {
  id: string
  agency_id: string
  user_id: string
  role: AgencyRole
  display_name: string | null
  notification_opt_out: boolean
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  agency_id: string
  name: string
  business_no: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  memo: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ClientMember {
  id: string
  client_id: string
  user_id: string
  role: ClientRole
  display_name: string | null
  phone: string | null
  notification_opt_out: boolean
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  agency_id: string
  client_id: string
  code: string
  name: string
  status: ProjectStatus
  github_org: string | null
  vercel_team_slug: string | null
  supabase_org_slug: string | null
  primary_domain: string | null
  started_at: string | null
  target_launch_at: string | null
  delivered_at: string | null
  last_client_activity_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  side: Side
  created_at: string
  updated_at: string
}

export interface OnboardingTemplate {
  id: string
  agency_id: string
  name: string
  description: string | null
  is_default: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface OnboardingTemplateStep {
  id: string
  template_id: string
  order_index: number
  key: string
  title: string
  description_md: string
  owner_side: OwnerSide
  verify_type: VerifyType
  est_minutes: number | null
  is_required: boolean
  created_at: string
  updated_at: string
}

export interface VerifyResultRecord {
  status: 'verified' | 'not_found' | 'error'
  detail?: string
  error?: string
  checkedAt: string
}

export interface ProjectStep {
  id: string
  project_id: string
  order_index: number
  key: string
  template_step_key: string | null
  title: string
  description_md: string
  owner_side: OwnerSide
  verify_type: VerifyType
  est_minutes: number | null
  is_required: boolean
  status: StepStatus
  blocked_reason: string | null
  client_done_at: string | null
  verified_at: string | null
  verified_by: string | null
  verify_result: VerifyResultRecord | null
  created_at: string
  updated_at: string
}

export interface IntakeForm {
  id: string
  agency_id: string
  version: string
  schema: Json
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface IntakeResponse {
  id: string
  project_id: string
  form_id: string
  answers: Record<string, Json>
  agency_notes: Record<string, Json>
  progress_pct: number
  last_stage_key: string | null
  submitted_at: string | null
  unlocked_at: string | null
  created_at: string
  updated_at: string
}

export interface Deliverable {
  id: string
  project_id: string
  kind: DeliverableKind
  title: string
  description: string | null
  url: string | null
  storage_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  version: string | null
  status: DeliverableStatus
  shared_at: string | null
  approved_at: string | null
  approved_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Comment {
  id: string
  project_id: string
  subject_type: CommentSubjectType
  subject_id: string | null
  author_user_id: string
  author_side: Side
  body_md: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ProjectInvite {
  id: string
  project_id: string
  email: string
  role: ClientRole
  token_hash: string
  expires_at: string
  accepted_at: string | null
  accepted_user_id: string | null
  revoked_at: string | null
  invited_by: string | null
  created_at: string
  updated_at: string
}

export interface NotificationRecord {
  id: string
  project_id: string | null
  user_id: string | null
  to_email: string
  type: string
  channel: 'email'
  subject: string | null
  threshold_days: number | null
  sent_at: string | null
  error: string | null
  meta: Record<string, Json>
  created_at: string
  updated_at: string
}

export interface CostRate {
  id: string
  agency_id: string
  service: CostService
  plan: string
  item_key: string
  label: string
  unit: string
  included_qty: number
  unit_price_usd: number
  fixed_price_usd: number
  effective_from: string
  note: string | null
  created_at: string
  updated_at: string
}

export interface CostEstimate {
  id: string
  project_id: string
  inputs: Json
  breakdown: Json
  monthly_total_usd: number
  monthly_total_krw: number
  usd_krw_rate: number
  rates_effective_from: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  agency_id: string | null
  project_id: string | null
  actor_user_id: string | null
  actor_side: 'agency' | 'client' | 'system' | null
  action: string
  meta: Record<string, Json>
  ip: string | null
  user_agent: string | null
  client_visible: boolean
  created_at: string
  updated_at: string
}

export interface Consent {
  id: string
  user_id: string | null
  email: string
  project_id: string | null
  kind: ConsentKind
  version: string
  agreed: boolean
  ip: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
}
