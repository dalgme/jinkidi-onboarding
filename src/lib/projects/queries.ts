import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { calculateProgress, daysSince, STALLED_THRESHOLD_DAYS } from '@/lib/onboarding/progress'
import type { Project, ProjectStatus, StepStatus } from '@/types/database'

export interface ProjectListRow extends Project {
  clients: { id: string; name: string } | null
  project_steps: { status: StepStatus; is_required: boolean }[]
}

export interface ProjectSummary {
  project: ProjectListRow
  progressPct: number
  verifiedCount: number
  requiredCount: number
  idleDays: number | null
  stalled: boolean
}

export interface ProjectListFilters {
  status?: ProjectStatus | 'all'
  stalledOnly?: boolean
}

/**
 * 프로젝트 목록.
 *
 * 기본 정렬은 «마지막 활동일 오름차순» — 개발사가 매일 아침 열었을 때
 * 방치된 프로젝트가 맨 위에 있어야 한다 (설계 문서 9단계).
 */
export async function listProjects(
  supabase: SupabaseClient,
  filters: ProjectListFilters = {},
): Promise<ProjectSummary[]> {
  let query = supabase
    .from('projects')
    .select('*, clients(id, name), project_steps(status, is_required)')
    .is('deleted_at', null)

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query.returns<ProjectListRow[]>()
  if (error) throw new Error(error.message)

  const now = new Date()
  const summaries = (data ?? []).map((project) => {
    const progress = calculateProgress(project.project_steps ?? [])
    const idleDays = daysSince(project.last_client_activity_at ?? project.created_at, now)
    return {
      project,
      progressPct: progress.pct,
      verifiedCount: progress.verified,
      requiredCount: progress.total,
      idleDays,
      stalled: idleDays !== null && idleDays >= STALLED_THRESHOLD_DAYS && project.status === 'onboarding',
    }
  })

  const filtered = filters.stalledOnly ? summaries.filter((s) => s.stalled) : summaries

  // 오래 방치된 것이 위로. 활동 기록이 없으면 생성일을 쓴다.
  return filtered.sort((a, b) => {
    const aAt = a.project.last_client_activity_at ?? a.project.created_at
    const bAt = b.project.last_client_activity_at ?? b.project.created_at
    return aAt.localeCompare(bAt)
  })
}

/** 의뢰인 활동이 있었음을 기록한다. 리마인더 크론과 정체 판정의 근거가 된다 */
export async function touchClientActivity(supabase: SupabaseClient, projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ last_client_activity_at: new Date().toISOString() })
    .eq('id', projectId)

  if (error) {
    console.error('[projects] failed to touch client activity', error.message)
  }
}
