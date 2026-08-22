'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'
import { canTransition } from '@/lib/onboarding/transitions'
import { touchClientActivity } from '@/lib/projects/queries'
import { notifyStepVerified } from '@/lib/mail/notify'
import type { ProjectStep, StepStatus } from '@/types/database'

const changeStatusSchema = z.object({
  projectCode: z.string().min(1),
  stepId: z.string().uuid(),
  status: z.enum(['pending', 'in_progress', 'client_done', 'verified', 'blocked', 'skipped']),
  blockedReason: z.string().trim().max(2000).optional(),
})

export interface StepActionResult {
  ok: boolean
  message?: string
}

const DENY_MESSAGE = {
  not_allowed_for_side: ko.common.forbiddenBody,
  step_not_owned_by_client: ko.portal.agencyStepNote,
  already_settled: ko.common.forbiddenBody,
  blocked_reason_required: ko.onboarding.blockedReasonRequired,
} as const

/**
 * 단계 상태 변경 — 개발사·의뢰인 양쪽이 쓴다.
 *
 * side는 요청 본문이 아니라 DB 소속으로 판정한다. 클라이언트가 「나는 개발사다」라고
 * 주장해도 무시된다. RLS의 WITH CHECK가 최종 방어선이지만, 여기서 먼저 걸러야
 * 사용자에게 알아볼 수 있는 메시지를 줄 수 있다.
 */
export async function changeStepStatus(input: unknown): Promise<StepActionResult> {
  const parsed = changeStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: ko.common.unknownError }
  }
  const { projectCode, stepId, status, blockedReason } = parsed.data

  const { supabase, user, project, side } = await requireProjectAccess(projectCode)

  const { data: step } = await supabase
    .from('project_steps')
    .select('*')
    .eq('id', stepId)
    .eq('project_id', project.id)
    .maybeSingle<ProjectStep>()

  if (!step) {
    return { ok: false, message: ko.common.notFoundBody }
  }

  const verdict = canTransition({
    side,
    ownerSide: step.owner_side,
    from: step.status,
    to: status,
    blockedReason,
  })

  if (!verdict.ok) {
    return { ok: false, message: DENY_MESSAGE[verdict.reason] }
  }

  const now = new Date().toISOString()
  const patch: Record<string, string | null> = {
    status,
    blocked_reason: status === 'blocked' ? (blockedReason ?? null) : null,
  }

  if (status === 'client_done') {
    patch.client_done_at = now
  }
  if (status === 'verified') {
    patch.verified_at = now
    patch.verified_by = user.id
  } else if (step.status === 'verified') {
    // verified에서 내려오면 검증 흔적도 함께 지운다
    patch.verified_at = null
    patch.verified_by = null
  }

  const { error } = await supabase.from('project_steps').update(patch).eq('id', stepId)

  if (error) {
    return { ok: false, message: error.message }
  }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: side,
    action: 'step.status_changed',
    meta: {
      step_id: stepId,
      step_key: step.key,
      from: step.status,
      to: status,
      ...(blockedReason ? { blocked_reason: blockedReason } : {}),
    },
    // 의뢰인 포털의 «최근 소식»에 올릴 만한 변화만 노출한다
    clientVisible: status === 'verified' || status === 'blocked' || status === 'skipped',
  })

  if (side === 'client') {
    await touchClientActivity(supabase, project.id)
  }

  // 확인 완료는 의뢰인에게 알린다 — 기다리던 소식이다
  if (status === 'verified') {
    await notifyStepVerified(supabase, project, step.title)
  }

  revalidatePath(`/app/projects/${projectCode}/onboarding`)
  revalidatePath(`/p/${projectCode}`)
  revalidatePath(`/p/${projectCode}/steps/${step.key}`)

  return { ok: true }
}

export async function isBlockedTransition(status: StepStatus): Promise<boolean> {
  return status === 'blocked'
}
