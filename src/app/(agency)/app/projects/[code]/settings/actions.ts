'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireAgencyProject } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'

const statusSchema = z.enum(['onboarding', 'building', 'delivered', 'archived', 'on_hold'])

export interface SettingsResult {
  ok: boolean
  message?: string
}

export async function updateProjectStatus(projectCode: string, nextStatus: string): Promise<SettingsResult> {
  const parsed = statusSchema.safeParse(nextStatus)
  if (!parsed.success) return { ok: false, message: ko.common.unknownError }

  const { supabase, user, project } = await requireAgencyProject(projectCode)

  const patch: Record<string, string | null> = { status: parsed.data }
  // 납품 완료로 바뀌면 그 시각을 남긴다 — 온보딩 소요일 지표의 종점이 된다
  if (parsed.data === 'delivered' && !project.delivered_at) {
    patch.delivered_at = new Date().toISOString()
  }

  const { error } = await supabase.from('projects').update(patch).eq('id', project.id)
  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'project.updated',
    meta: { from: project.status, to: parsed.data },
  })

  revalidatePath(`/app/projects/${projectCode}`, 'layout')
  return { ok: true }
}
