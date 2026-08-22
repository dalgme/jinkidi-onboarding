'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireAgencyMember } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'
import { createProjectSteps } from '@/lib/onboarding/instantiate'
import { PROJECT_CODE_PATTERN } from '@/lib/onboarding/slug'

export const projectSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  // code는 URL에 노출된다. 한국어 slug는 받지 않는다.
  code: z.string().trim().min(2).max(40).regex(PROJECT_CODE_PATTERN, ko.agency.projectCodeInvalid),
  templateId: z.string().uuid(),
  targetLaunchAt: z.string().optional(),
})

export type ProjectInput = z.infer<typeof projectSchema>

export interface CreateProjectResult {
  ok: boolean
  code?: string
  message?: string
}

export async function createProject(input: unknown): Promise<CreateProjectResult> {
  const parsed = projectSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? ko.common.unknownError }
  }

  const { supabase, user, member } = await requireAgencyMember()
  const values = parsed.data

  const { data: existing } = await supabase.from('projects').select('id').eq('code', values.code).maybeSingle()
  if (existing) {
    return { ok: false, message: ko.agency.projectCodeTaken }
  }

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      agency_id: member.agency_id,
      client_id: values.clientId,
      code: values.code,
      name: values.name,
      status: 'onboarding',
      started_at: new Date().toISOString(),
      target_launch_at: values.targetLaunchAt ? new Date(values.targetLaunchAt).toISOString() : null,
    })
    .select('id, code')
    .single<{ id: string; code: string }>()

  if (error) {
    return { ok: false, message: error.message }
  }

  // 템플릿 단계를 «복사»한다. 참조가 아니다 (설계 문서 2.2)
  const instantiated = await createProjectSteps(supabase, project.id, values.templateId)
  if (!instantiated.ok) {
    // 단계 없이 남은 프로젝트는 쓸모가 없다. 되돌리고 오류를 알린다.
    await supabase.from('projects').delete().eq('id', project.id)
    return { ok: false, message: instantiated.error ?? ko.common.unknownError }
  }

  await writeAudit(supabase, {
    agencyId: member.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'project.created',
    meta: { code: project.code, name: values.name, steps_created: instantiated.created },
  })

  await writeAudit(supabase, {
    agencyId: member.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'steps.instantiated',
    meta: { template_id: values.templateId, count: instantiated.created },
  })

  revalidatePath('/app')
  return { ok: true, code: project.code }
}
