'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'
import { calculateIntakeProgress, parseAnswers, parseIntakeForm, answersSchema } from '@/lib/intake/schema'
import { notifyIntakeSubmitted } from '@/lib/mail/notify'
import { touchClientActivity } from '@/lib/projects/queries'
import type { IntakeForm, IntakeResponse } from '@/types/database'

const saveSchema = z.object({
  projectCode: z.string().min(1),
  answers: answersSchema,
  lastStageKey: z.string().max(60).optional(),
})

export interface IntakeSaveResult {
  ok: boolean
  message?: string
  savedAt?: string
  progressPct?: number
}

/**
 * 인테이크 자동저장.
 *
 * ⚠ 자동저장이 없으면 완료율이 절반 이하로 떨어진다.
 *   32문항은 한 자리에서 끝나지 않는다. 의뢰인은 반드시 중간에 이탈하고
 *   며칠 뒤 돌아온다.
 *
 * ⚠ 실패를 조용히 넘기지 않는다. 화면에 «저장 실패»를 띄우고 재시도를 준다 —
 *   저장된 줄 알고 창을 닫으면 32문항을 다시 채워야 한다.
 */
export async function saveIntakeAnswers(input: unknown): Promise<IntakeSaveResult> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: ko.intake.autosaveFailed }
  }
  const { projectCode, answers, lastStageKey } = parsed.data

  const { supabase, project, side } = await requireProjectAccess(projectCode)

  const { data: response } = await supabase
    .from('intake_responses')
    .select('*')
    .eq('project_id', project.id)
    .maybeSingle<IntakeResponse>()

  if (!response) {
    return { ok: false, message: ko.intake.notStarted }
  }

  // 제출 후에는 개발사가 잠금을 풀어야 다시 쓸 수 있다 (RLS도 동일하게 막는다)
  if (side === 'client' && response.submitted_at !== null && response.unlocked_at === null) {
    return { ok: false, message: ko.intake.submittedLocked }
  }

  const { data: form } = await supabase
    .from('intake_forms')
    .select('*')
    .eq('id', response.form_id)
    .maybeSingle<IntakeForm>()

  if (!form) {
    return { ok: false, message: ko.common.unknownError }
  }

  const progressPct = calculateIntakeProgress(parseIntakeForm(form.schema), parseAnswers(answers))

  const { error } = await supabase
    .from('intake_responses')
    .update({
      answers,
      progress_pct: progressPct,
      last_stage_key: lastStageKey ?? response.last_stage_key,
    })
    .eq('id', response.id)

  if (error) {
    return { ok: false, message: ko.intake.autosaveFailed }
  }

  if (side === 'client') {
    await touchClientActivity(supabase, project.id)
  }

  return { ok: true, savedAt: new Date().toISOString(), progressPct }
}

export async function submitIntake(projectCode: string): Promise<IntakeSaveResult> {
  const { supabase, user, project, side } = await requireProjectAccess(projectCode)

  const { data: response } = await supabase
    .from('intake_responses')
    .select('*')
    .eq('project_id', project.id)
    .maybeSingle<IntakeResponse>()

  if (!response) return { ok: false, message: ko.intake.notStarted }

  const { error } = await supabase
    .from('intake_responses')
    .update({ submitted_at: new Date().toISOString(), unlocked_at: null })
    .eq('id', response.id)

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: side,
    action: 'intake.submitted',
    meta: { progress_pct: response.progress_pct },
  })

  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', project.client_id)
    .maybeSingle<{ name: string }>()

  await notifyIntakeSubmitted(supabase, project, client?.name ?? '')

  revalidatePath(`/p/${projectCode}/intake`)
  revalidatePath(`/app/projects/${projectCode}/intake`)

  return { ok: true }
}

/** 개발사가 잠금을 푼다 — 의뢰인이 다시 수정할 수 있게 */
export async function unlockIntake(projectCode: string): Promise<IntakeSaveResult> {
  const { supabase, user, project, side } = await requireProjectAccess(projectCode)
  if (side !== 'agency') return { ok: false, message: ko.common.forbiddenBody }

  const { error } = await supabase
    .from('intake_responses')
    .update({ unlocked_at: new Date().toISOString() })
    .eq('project_id', project.id)

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'intake.unlocked',
    meta: {},
    clientVisible: true,
  })

  revalidatePath(`/p/${projectCode}/intake`)
  revalidatePath(`/app/projects/${projectCode}/intake`)
  return { ok: true }
}

const noteSchema = z.object({
  projectCode: z.string().min(1),
  questionKey: z.string().min(1).max(80),
  note: z.string().max(5000),
})

/** 개발사가 «추천 필요» 문항에 제안을 채워 넣는다 */
export async function saveAgencyNote(input: unknown): Promise<IntakeSaveResult> {
  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: ko.common.unknownError }

  const { projectCode, questionKey, note } = parsed.data
  const { supabase, user, project, side } = await requireProjectAccess(projectCode)
  if (side !== 'agency') return { ok: false, message: ko.common.forbiddenBody }

  const { data: response } = await supabase
    .from('intake_responses')
    .select('*')
    .eq('project_id', project.id)
    .maybeSingle<IntakeResponse>()

  if (!response) return { ok: false, message: ko.intake.notStarted }

  const notes = { ...(response.agency_notes as Record<string, unknown>), [questionKey]: note }

  const { error } = await supabase.from('intake_responses').update({ agency_notes: notes }).eq('id', response.id)
  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'intake.note_saved',
    meta: { question_key: questionKey },
    clientVisible: true,
  })

  revalidatePath(`/p/${projectCode}/intake`)
  revalidatePath(`/app/projects/${projectCode}/intake`)
  return { ok: true }
}

/**
 * 인테이크 응답 레코드를 보장한다. 포털 첫 진입 시 호출된다.
 * (프로젝트 생성 시에 만들지 않는 이유 — 기본 폼 버전이 그 사이 바뀔 수 있다)
 */
export async function ensureIntakeResponse(projectCode: string): Promise<IntakeSaveResult> {
  const { supabase, project } = await requireProjectAccess(projectCode)

  const { data: existing } = await supabase
    .from('intake_responses')
    .select('id')
    .eq('project_id', project.id)
    .maybeSingle()

  if (existing) return { ok: true }

  const { data: form } = await supabase
    .from('intake_forms')
    .select('id')
    .eq('agency_id', project.agency_id)
    .eq('is_default', true)
    .maybeSingle<{ id: string }>()

  if (!form) return { ok: false, message: ko.intake.notStarted }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  const { error } = await admin
    .from('intake_responses')
    .insert({ project_id: project.id, form_id: form.id, answers: {}, progress_pct: 0 })

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
