import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { getUser } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'
import { runVerification } from '@/lib/verify'
import type { AgencyMember, Project, ProjectStep, VerifyType } from '@/types/database'

const bodySchema = z.object({
  projectCode: z.string().min(1),
  stepId: z.string().uuid(),
})

const VERIFY_TYPES: VerifyType[] = ['github_member', 'vercel_member', 'supabase_member', 'dns']

/**
 * 검증 실행 — 설계 문서 12.2 / 단계 13
 *
 *   - 개발사 멤버 가드 필수 (Route Handler는 미들웨어를 신뢰하지 않는다)
 *   - 결과는 verify_result(jsonb)에 그대로 저장
 *   - verified일 때만 status를 verified로 올린다.
 *     not_found·error는 상태를 «바꾸지 않는다» — 검증 실패가 진행 상황을 되돌리면 안 된다
 *   - 성공·실패 모두 audit_logs에 남긴다
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params

  if (!VERIFY_TYPES.includes(type as VerifyType)) {
    return NextResponse.json({ error: 'unsupported_verify_type' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { supabase, user } = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('code', parsed.data.projectCode)
    .is('deleted_at', null)
    .maybeSingle<Project>()

  if (!project) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // 검증은 개발사만 실행할 수 있다. 의뢰인이 자기 단계를 verified로 올리는 경로가 되면 안 된다.
  const { data: member } = await supabase
    .from('agency_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('agency_id', project.agency_id)
    .maybeSingle<AgencyMember>()

  if (!member) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: step } = await supabase
    .from('project_steps')
    .select('*')
    .eq('id', parsed.data.stepId)
    .eq('project_id', project.id)
    .maybeSingle<ProjectStep>()

  if (!step) {
    return NextResponse.json({ error: 'step_not_found' }, { status: 404 })
  }

  if (step.verify_type !== type) {
    return NextResponse.json({ error: 'verify_type_mismatch' }, { status: 400 })
  }

  const result = await runVerification(step.verify_type, project)

  const patch: Record<string, unknown> = { verify_result: result }
  if (result.status === 'verified') {
    patch.status = 'verified'
    patch.verified_at = result.checkedAt
    patch.verified_by = user.id
    patch.blocked_reason = null
  }

  const { error: updateError } = await supabase.from('project_steps').update(patch).eq('id', step.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'step.verify_run',
    meta: {
      step_id: step.id,
      step_key: step.key,
      verify_type: step.verify_type,
      status: result.status,
      ...(result.status === 'error' ? { error: result.error } : { detail: result.detail }),
    },
    clientVisible: result.status === 'verified',
  })

  if (result.status === 'verified') {
    const { notifyStepVerified } = await import('@/lib/mail/notify')
    await notifyStepVerified(supabase, project, step.title)
  }

  return NextResponse.json({ result })
}
