import type { CostRate, CostService } from '@/types/database'

/**
 * 월 고정비 계산기 — 설계 문서 2.5
 *
 * ⚠ 요율을 코드에 박지 않는다.
 *   Vercel·Supabase 요금제는 계속 바뀐다. 하드코딩하면 6개월 뒤 계산기가 조용히
 *   틀린 숫자를 뱉는데, 그 숫자로 견적을 냈다는 사실을 아무도 모른다.
 *   모든 값은 cost_rates 테이블에서 온다. 이 모듈은 순수 계산만 한다.
 */

export interface CostInputs {
  /** 월 방문자 수 — 전송량 추정의 근거 */
  monthlyVisitors: number
  /** DB 크기 (GB) */
  dbSizeGb: number
  /** 파일 저장 용량 (GB) */
  storageGb: number
  /** 월 메일 발송 수 */
  monthlyEmails: number
  /** Vercel 좌석 수 */
  seats: number
  /** 적용 환율 (USD → KRW). 자동 조회하지 않는다 */
  usdKrwRate: number
}

export interface CostLine {
  service: CostService
  plan: string
  itemKey: string
  label: string
  unit: string
  /** 추정 사용량 */
  usage: number
  /** 요금제에 포함된 양 */
  included: number
  /** 과금 대상 초과분 */
  billable: number
  amountUsd: number
}

export interface CostBreakdown {
  lines: CostLine[]
  byService: { service: CostService; amountUsd: number }[]
  monthlyTotalUsd: number
  monthlyTotalKrw: number
  /** 계산에 사용한 요율의 적용일. 화면에 반드시 표시한다 */
  ratesEffectiveFrom: string
  usdKrwRate: number
}

/** 방문자 1인당 전송량 추정치 (GB). 화면에 근거로 노출한다 */
export const GB_PER_VISITOR = 0.003

/** 방문자 1인당 함수 실행량 추정치 (GB-hour) */
export const FUNCTION_GB_HOURS_PER_VISITOR = 0.0008

function usageFor(itemKey: string, inputs: CostInputs): number {
  switch (itemKey) {
    case 'seat':
      return inputs.seats
    case 'bandwidth_gb':
      return round(inputs.monthlyVisitors * GB_PER_VISITOR, 2)
    case 'function_gb_hours':
      return round(inputs.monthlyVisitors * FUNCTION_GB_HOURS_PER_VISITOR, 2)
    case 'db_size_gb':
      return inputs.dbSizeGb
    case 'storage_gb':
      return inputs.storageGb
    case 'emails':
      return inputs.monthlyEmails
    case 'base':
    case 'registration':
      return 1
    default:
      return 0
  }
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/**
 * 적용일이 기준일 이하인 요율 중 가장 최근 것만 남긴다.
 * 요율이 바뀌어도 과거 견적을 재현할 수 있도록, 기존 행을 고치는 대신
 * 새 effective_from으로 행을 추가하는 운영 규칙을 전제로 한다.
 */
export function selectActiveRates(rates: readonly CostRate[], asOf: Date = new Date()): CostRate[] {
  const cutoff = asOf.toISOString().slice(0, 10)
  const byItem = new Map<string, CostRate>()

  for (const rate of rates) {
    if (rate.effective_from > cutoff) continue
    const key = `${rate.service}:${rate.plan}:${rate.item_key}`
    const current = byItem.get(key)
    if (!current || rate.effective_from > current.effective_from) {
      byItem.set(key, rate)
    }
  }

  return [...byItem.values()]
}

export function calculateCost(inputs: CostInputs, rates: readonly CostRate[], asOf: Date = new Date()): CostBreakdown {
  const active = selectActiveRates(rates, asOf)

  const lines: CostLine[] = active.map((rate) => {
    const usage = usageFor(rate.item_key, inputs)
    const billable = Math.max(0, usage - Number(rate.included_qty))
    const amountUsd = round(Number(rate.fixed_price_usd) + billable * Number(rate.unit_price_usd), 2)

    return {
      service: rate.service,
      plan: rate.plan,
      itemKey: rate.item_key,
      label: rate.label,
      unit: rate.unit,
      usage,
      included: Number(rate.included_qty),
      billable: round(billable, 2),
      amountUsd,
    }
  })

  // Resend는 무료 한도 안이면 Pro 요금을 태우지 않는다
  const filtered = lines.filter((line) => {
    if (line.service !== 'resend') return true
    if (line.plan === 'free') return true
    const free = lines.find((l) => l.service === 'resend' && l.plan === 'free')
    return free ? free.billable > 0 : true
  })

  const byServiceMap = new Map<CostService, number>()
  for (const line of filtered) {
    byServiceMap.set(line.service, round((byServiceMap.get(line.service) ?? 0) + line.amountUsd, 2))
  }

  const monthlyTotalUsd = round(
    filtered.reduce((sum, line) => sum + line.amountUsd, 0),
    2,
  )

  const ratesEffectiveFrom = active.reduce<string>(
    (latest, rate) => (rate.effective_from > latest ? rate.effective_from : latest),
    active[0]?.effective_from ?? new Date().toISOString().slice(0, 10),
  )

  return {
    lines: filtered,
    byService: [...byServiceMap.entries()].map(([service, amountUsd]) => ({ service, amountUsd })),
    monthlyTotalUsd,
    monthlyTotalKrw: Math.round(monthlyTotalUsd * inputs.usdKrwRate),
    ratesEffectiveFrom,
    usdKrwRate: inputs.usdKrwRate,
  }
}

export const DEFAULT_COST_INPUTS: CostInputs = {
  monthlyVisitors: 10_000,
  dbSizeGb: 2,
  storageGb: 5,
  monthlyEmails: 1_000,
  seats: 1,
  usdKrwRate: 1_380,
}
