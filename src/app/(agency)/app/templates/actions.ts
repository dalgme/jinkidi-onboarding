'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireAgencyRole } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'
import type { OnboardingTemplateStep } from '@/types/database'

export interface TemplateActionResult {
  ok: boolean
  message?: string
}

const stepSchema = z.object({
  templateId: z.string().uuid(),
  stepId: z.string().uuid().optional(),
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, ko.agency.projectCodeInvalid),
  title: z.string().trim().min(1).max(160),
  descriptionMd: z.string().max(20_000),
  ownerSide: z.enum(['client', 'agency', 'both']),
  verifyType: z.enum(['manual', 'github_member', 'vercel_member', 'supabase_member', 'dns']),
  estMinutes: z.coerce.number().int().min(0).max(10_000).optional(),
  isRequired: z.boolean(),
})

export async function saveTemplateStep(input: unknown): Promise<TemplateActionResult> {
  const parsed = stepSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? ko.common.unknownError }
  }
  const values = parsed.data

  const { supabase, user, member } = await requireAgencyRole('admin')

  const payload = {
    template_id: values.templateId,
    key: values.key,
    title: values.title,
    description_md: values.descriptionMd,
    owner_side: values.ownerSide,
    verify_type: values.verifyType,
    est_minutes: values.estMinutes ?? null,
    is_required: values.isRequired,
  }

  let error: string | null = null

  if (values.stepId) {
    const { error: updateError } = await supabase
      .from('onboarding_template_steps')
      .update(payload)
      .eq('id', values.stepId)
    error = updateError?.message ?? null
  } else {
    // 새 단계는 맨 끝에 붙인다
    const { data: last } = await supabase
      .from('onboarding_template_steps')
      .select('order_index')
      .eq('template_id', values.templateId)
      .order('order_index', { ascending: false })
      .limit(1)
      .maybeSingle<{ order_index: number }>()

    const { error: insertError } = await supabase
      .from('onboarding_template_steps')
      .insert({ ...payload, order_index: (last?.order_index ?? 0) + 1 })
    error = insertError?.message ?? null
  }

  if (error) return { ok: false, message: error }

  await writeAudit(supabase, {
    agencyId: member.agency_id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'template.updated',
    meta: { template_id: values.templateId, step_key: values.key, mode: values.stepId ? 'update' : 'create' },
  })

  revalidatePath('/app/templates')
  return { ok: true }
}

export async function moveTemplateStep(
  templateId: string,
  stepId: string,
  direction: 'up' | 'down',
): Promise<TemplateActionResult> {
  const { supabase } = await requireAgencyRole('admin')

  const { data: steps } = await supabase
    .from('onboarding_template_steps')
    .select('*')
    .eq('template_id', templateId)
    .order('order_index', { ascending: true })
    .returns<OnboardingTemplateStep[]>()

  const list = steps ?? []
  const index = list.findIndex((s) => s.id === stepId)
  if (index === -1) return { ok: false, message: ko.common.notFoundBody }

  const swapWith = direction === 'up' ? index - 1 : index + 1
  const current = list[index]
  const neighbour = list[swapWith]
  if (!current || !neighbour) return { ok: true }

  /*
   * (template_id, key)에 unique 제약이 있으나 order_index에는 없으므로
   * 두 행의 order_index를 그대로 맞바꿔도 충돌하지 않는다.
   */
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('onboarding_template_steps').update({ order_index: neighbour.order_index }).eq('id', current.id),
    supabase.from('onboarding_template_steps').update({ order_index: current.order_index }).eq('id', neighbour.id),
  ])

  if (e1 || e2) return { ok: false, message: e1?.message ?? e2?.message }

  revalidatePath('/app/templates')
  return { ok: true }
}

export async function deleteTemplateStep(stepId: string): Promise<TemplateActionResult> {
  const { supabase } = await requireAgencyRole('admin')

  const { error } = await supabase.from('onboarding_template_steps').delete().eq('id', stepId)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/app/templates')
  return { ok: true }
}

const templateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
})

export async function createTemplate(input: unknown): Promise<TemplateActionResult> {
  const parsed = templateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: ko.common.unknownError }

  const { supabase, member } = await requireAgencyRole('admin')

  const { error } = await supabase.from('onboarding_templates').insert({
    agency_id: member.agency_id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    is_default: false,
  })

  if (error) return { ok: false, message: error.message }

  revalidatePath('/app/templates')
  return { ok: true }
}
