import { describe, expect, it } from 'vitest'

import { calculateCost, selectActiveRates, type CostInputs } from '@/lib/cost/calculator'
import type { CostRate } from '@/types/database'

function rate(overrides: Partial<CostRate> & Pick<CostRate, 'service' | 'item_key'>): CostRate {
  return {
    id: `${overrides.service}-${overrides.item_key}-${overrides.effective_from ?? '2026-08-01'}`,
    agency_id: 'agency',
    plan: 'pro',
    label: overrides.item_key,
    unit: 'GB',
    included_qty: 0,
    unit_price_usd: 0,
    fixed_price_usd: 0,
    effective_from: '2026-08-01',
    note: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  } as CostRate
}

const inputs: CostInputs = {
  monthlyVisitors: 10_000,
  dbSizeGb: 10,
  storageGb: 120,
  monthlyEmails: 500,
  seats: 2,
  usdKrwRate: 1_380,
}

describe('calculateCost', () => {
  it('포함량을 넘는 만큼만 과금한다', () => {
    const rates = [rate({ service: 'supabase', item_key: 'db_size_gb', included_qty: 8, unit_price_usd: 0.125 })]
    const result = calculateCost(inputs, rates)

    const line = result.lines[0]
    expect(line?.usage).toBe(10)
    expect(line?.included).toBe(8)
    expect(line?.billable).toBe(2)
    expect(line?.amountUsd).toBe(0.25)
  })

  it('포함량 안이면 0원이다', () => {
    const rates = [rate({ service: 'supabase', item_key: 'storage_gb', included_qty: 500, unit_price_usd: 0.021 })]
    expect(calculateCost(inputs, rates).monthlyTotalUsd).toBe(0)
  })

  it('고정비는 사용량과 무관하게 붙는다', () => {
    const rates = [rate({ service: 'supabase', item_key: 'base', fixed_price_usd: 25 })]
    expect(calculateCost(inputs, rates).monthlyTotalUsd).toBe(25)
  })

  it('좌석 수만큼 곱한다', () => {
    const rates = [rate({ service: 'vercel', item_key: 'seat', unit_price_usd: 20 })]
    expect(calculateCost(inputs, rates).monthlyTotalUsd).toBe(40)
  })

  it('환율을 적용해 원화를 낸다', () => {
    const rates = [rate({ service: 'supabase', item_key: 'base', fixed_price_usd: 25 })]
    expect(calculateCost(inputs, rates).monthlyTotalKrw).toBe(34_500)
  })

  it('사용한 요율의 적용일을 결과에 담는다 — 「그때 이 요율로 안내했다」의 근거', () => {
    const rates = [
      rate({ service: 'supabase', item_key: 'base', fixed_price_usd: 25, effective_from: '2026-01-01' }),
      rate({ service: 'supabase', item_key: 'base', fixed_price_usd: 30, effective_from: '2026-08-01' }),
    ]
    const result = calculateCost(inputs, rates, new Date('2026-08-21'))
    expect(result.ratesEffectiveFrom).toBe('2026-08-01')
    expect(result.monthlyTotalUsd).toBe(30)
  })

  it('요율이 없으면 0이지 오류가 아니다', () => {
    expect(calculateCost(inputs, []).monthlyTotalUsd).toBe(0)
  })
})

describe('selectActiveRates', () => {
  it('기준일 이하 중 가장 최근 요율만 남긴다', () => {
    const rates = [
      rate({ service: 'vercel', item_key: 'seat', unit_price_usd: 20, effective_from: '2026-01-01' }),
      rate({ service: 'vercel', item_key: 'seat', unit_price_usd: 25, effective_from: '2026-08-01' }),
    ]
    const active = selectActiveRates(rates, new Date('2026-08-21'))
    expect(active).toHaveLength(1)
    expect(Number(active[0]?.unit_price_usd)).toBe(25)
  })

  it('미래 요율은 아직 쓰지 않는다', () => {
    const rates = [
      rate({ service: 'vercel', item_key: 'seat', unit_price_usd: 20, effective_from: '2026-01-01' }),
      rate({ service: 'vercel', item_key: 'seat', unit_price_usd: 99, effective_from: '2027-01-01' }),
    ]
    const active = selectActiveRates(rates, new Date('2026-08-21'))
    expect(Number(active[0]?.unit_price_usd)).toBe(20)
  })
})
