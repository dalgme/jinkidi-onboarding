import 'server-only'

import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { SupabaseClient, User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'
import type { AgencyMember, Project, Side } from '@/types/database'

/**
 * 권한 가드 — 설계 문서 8단계
 *
 * 미들웨어만 믿지 않는다. matcher 실수 한 번으로 통째로 우회되기 때문에
 * 모든 Server Component와 Route Handler에서 이 가드를 먼저 호출한다.
 * RLS가 최종 방어선이지만 화면 레벨 가드도 반드시 둔다 (이중 방어).
 */

export type Supabase = SupabaseClient

export interface AgencyContext {
  supabase: Supabase
  user: User
  member: AgencyMember
}

export interface ProjectContext {
  supabase: Supabase
  user: User
  project: Project
  /** 이 사용자가 이 프로젝트에서 갖는 입장. 경로가 아니라 DB 소속으로 판정한다 */
  side: Side
  agencyRole: AgencyMember['role'] | null
}

export async function getUser(): Promise<{ supabase: Supabase; user: User | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

/** 개발사 멤버 확인. 아니면 로그인 또는 403으로 보낸다 */
export async function requireAgencyMember(): Promise<AgencyContext> {
  const { supabase, user } = await getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('agency_members')
    .select('*')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle<AgencyMember>()

  if (!member) redirect('/forbidden')

  return { supabase, user, member }
}

export async function requireAgencyRole(minimum: 'admin' | 'owner'): Promise<AgencyContext> {
  const ctx = await requireAgencyMember()
  const rank = { member: 0, admin: 1, owner: 2 }
  if (rank[ctx.member.role] < rank[minimum]) {
    redirect('/forbidden')
  }
  return ctx
}

/**
 * 프로젝트 접근권 확인.
 *
 * 권한이 없으면 403이 아니라 404를 준다 — 타사 프로젝트 code의 존재 여부 자체를
 * 알 수 없게 하기 위함이다 (설계 문서 8단계).
 */
export async function requireProjectAccess(code: string): Promise<ProjectContext> {
  const { supabase, user } = await getUser()
  if (!user) redirect('/login')

  // RLS가 이미 걸러주지만, 화면 레벨에서도 명시적으로 확인한다
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('code', code)
    .is('deleted_at', null)
    .maybeSingle<Project>()

  if (!project) notFoundRedirect()

  const { data: agencyMember } = await supabase
    .from('agency_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('agency_id', project.agency_id)
    .maybeSingle<AgencyMember>()

  if (agencyMember) {
    return { supabase, user, project, side: 'agency', agencyRole: agencyMember.role }
  }

  const { data: clientMember } = await supabase
    .from('client_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('client_id', project.client_id)
    .maybeSingle()

  if (!clientMember) notFoundRedirect()

  return { supabase, user, project, side: 'client', agencyRole: null }
}

/** 개발사 전용 화면에서 프로젝트를 열 때 */
export async function requireAgencyProject(code: string): Promise<ProjectContext> {
  const ctx = await requireProjectAccess(code)
  if (ctx.side !== 'agency') notFoundRedirect()
  return ctx
}

/**
 * 접근권이 없을 때 403이 아니라 404를 준다 —
 * 타사 프로젝트 code의 «존재 여부» 자체를 알 수 없게 하기 위함이다.
 */
function notFoundRedirect(): never {
  notFound()
}

/**
 * Route Handler용 가드 — redirect 대신 JSON 401/403/404를 준다.
 * 미들웨어를 신뢰하지 않고 핸들러마다 다시 호출한다.
 */
export type GuardFailure = { error: string; status: 401 | 403 | 404 }

export async function guardApiAgencyProject(
  projectCode: string,
): Promise<{ ok: true; ctx: { supabase: Supabase; user: User; project: Project } } | { ok: false; failure: GuardFailure }> {
  const { supabase, user } = await getUser()
  if (!user) return { ok: false, failure: { error: 'unauthorized', status: 401 } }

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('code', projectCode)
    .is('deleted_at', null)
    .maybeSingle<Project>()

  if (!project) return { ok: false, failure: { error: 'not_found', status: 404 } }

  const { data: member } = await supabase
    .from('agency_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('agency_id', project.agency_id)
    .maybeSingle()

  if (!member) return { ok: false, failure: { error: 'forbidden', status: 403 } }

  return { ok: true, ctx: { supabase, user, project } }
}

/** 감사 로그에 남길 요청 메타 */
export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  return {
    ip: forwarded?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
    userAgent: h.get('user-agent'),
  }
}
