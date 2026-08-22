'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireAgencyProject } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'
import { calculateCost, type CostInputs } from '@/lib/cost/calculator'
import type { CostRate } from '@/types/database'

const inputsSchema = z.object({
  projectCode: z.string().min(1),
  monthlyVisitors: z.coerce.number().min(0).max(100_000_000),
  dbSizeGb: z.coerce.number().min(0).max(100_000),
  storageGb: z.coerce.number().min(0).max(100_000),
  monthlyEmails: z.coerce.number().min(0).max(100_000_000),
  seats: z.coerce.number().int().min(0).max(1000),
  usdKrwRate: z.coerce.number().min(1).max(100_000),
})

export interface CostSnapshotResult {
  ok: boolean
  message?: string
}

/**
 * 견적 스냅샷 저장.
 *
 * ⚠ 사용한 요율의 effective_from을 함께 저장한다.
 *   «그때 이 요율로 안내했다»의 근거가 된다. 요율이 바뀐 뒤에도 과거 견적을
 *   그대로 재현할 수 있어야 한다.
 */
export async function saveCostSnapshot(input: unknown): Promise<CostSnapshotResult> {
  const parsed = inputsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? ko.common.unknownError }
  }
  const { projectCode, ...rest } = parsed.data
  const inputs: CostInputs = rest

  const { supabase, user, project } = await requireAgencyProject(projectCode)

  // 요율은 언제나 DB에서 읽는다. 코드에 하드코딩된 값은 없다.
  const { data: rates } = await supabase
    .from('cost_rates')
    .select('*')
    .eq('agency_id', project.agency_id)
    .returns<CostRate[]>()

  if (!rates || rates.length === 0) {
    return { ok: false, message: ko.cost.noRates }
  }

  const breakdown = calculateCost(inputs, rates)

  const { error } = await supabase.from('cost_estimates').insert({
    project_id: project.id,
    inputs,
    breakdown: { lines: breakdown.lines, byService: breakdown.byService },
    monthly_total_usd: breakdown.monthlyTotalUsd,
    monthly_total_krw: breakdown.monthlyTotalKrw,
    usd_krw_rate: breakdown.usdKrwRate,
    rates_effective_from: breakdown.ratesEffectiveFrom,
    created_by: user.id,
  })

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'cost.snapshot_saved',
    meta: {
      monthly_total_usd: breakdown.monthlyTotalUsd,
      rates_effective_from: breakdown.ratesEffectiveFrom,
    },
    clientVisible: true,
  })

  revalidatePath(`/app/projects/${projectCode}/cost`)
  revalidatePath(`/p/${projectCode}/cost`)
  return { ok: true }
}
