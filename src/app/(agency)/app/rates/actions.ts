'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireAgencyRole } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'

const rateSchema = z.object({
  service: z.enum(['vercel', 'supabase', 'domain', 'resend']),
  plan: z.string().trim().min(1).max(40),
  itemKey: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(160),
  unit: z.string().trim().min(1).max(30),
  includedQty: z.coerce.number().min(0),
  unitPriceUsd: z.coerce.number().min(0),
  fixedPriceUsd: z.coerce.number().min(0),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export interface RateResult {
  ok: boolean
  message?: string
}

/**
 * 요율 추가.
 *
 * ⚠ 기존 행을 «고치지» 않는다. 새 effective_from으로 행을 추가한다.
 *   과거 견적이 어떤 요율로 산출되었는지 재현할 수 있어야 하기 때문이다.
 */
export async function createRate(input: unknown): Promise<RateResult> {
  const parsed = rateSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? ko.common.unknownError }
  }
  const values = parsed.data

  const { supabase, user, member } = await requireAgencyRole('owner')

  const { error } = await supabase.from('cost_rates').insert({
    agency_id: member.agency_id,
    service: values.service,
    plan: values.plan,
    item_key: values.itemKey,
    label: values.label,
    unit: values.unit,
    included_qty: values.includedQty,
    unit_price_usd: values.unitPriceUsd,
    fixed_price_usd: values.fixedPriceUsd,
    effective_from: values.effectiveFrom,
  })

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: member.agency_id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'rate.updated',
    meta: { service: values.service, item_key: values.itemKey, effective_from: values.effectiveFrom },
  })

  revalidatePath('/app/rates')
  return { ok: true }
}
