import { describe, expect, it } from 'vitest'

import {
  calculateProgress,
  daysSince,
  findNextClientStep,
  isStalled,
  STALLED_THRESHOLD_DAYS,
} from '@/lib/onboarding/progress'
import type { OwnerSide, StepStatus } from '@/types/database'

function step(status: StepStatus, is_required = true) {
  return { status, is_required }
}

describe('calculateProgress', () => {
  it('verified는 1.0, client_done은 0.5로 가중한다', () => {
    // 이것이 이 시스템의 핵심 계약이다.
    // client_done을 100%로 계산하면 검증 자체가 무의미해진다.
    const result = calculateProgress([step('verified'), step('client_done'), step('pending'), step('pending')])
    expect(result.pct).toBe(38) // (1.0 + 0.5) / 4 = 37.5 → 38
    expect(result.verified).toBe(1)
    expect(result.total).toBe(4)
  })

  it('client_done만으로는 절대 100%가 되지 않는다', () => {
    const result = calculateProgress([step('client_done'), step('client_done')])
    expect(result.pct).toBe(50)
  })

  it('전부 verified면 100%', () => {
    expect(calculateProgress([step('verified'), step('verified')]).pct).toBe(100)
  })

  it('선택 단계는 분모에서 제외한다', () => {
    const result = calculateProgress([step('verified'), step('pending', false)])
    expect(result.total).toBe(1)
    expect(result.pct).toBe(100)
  })

  it('skipped는 분모에서 뺀다 — 「해당 없음」이 진행률을 영원히 막으면 안 된다', () => {
    const result = calculateProgress([step('verified'), step('skipped')])
    expect(result.total).toBe(1)
    expect(result.pct).toBe(100)
  })

  it('blocked와 in_progress는 0으로 계산한다', () => {
    expect(calculateProgress([step('blocked'), step('in_progress')]).pct).toBe(0)
  })

  it('단계가 없으면 100%로 본다 (0으로 나누지 않는다)', () => {
    expect(calculateProgress([]).pct).toBe(100)
    expect(calculateProgress([step('pending', false)]).pct).toBe(100)
  })
})

describe('findNextClientStep', () => {
  function s(overrides: { status: StepStatus; owner_side: OwnerSide; order_index: number; key?: string }) {
    return { key: overrides.key ?? 'k', ...overrides }
  }

  it('의뢰인 담당 미완료 단계 중 순서가 가장 빠른 하나만 고른다', () => {
    const next = findNextClientStep([
      s({ status: 'pending', owner_side: 'client', order_index: 3, key: 'c' }),
      s({ status: 'pending', owner_side: 'client', order_index: 1, key: 'a' }),
      s({ status: 'pending', owner_side: 'client', order_index: 2, key: 'b' }),
    ])
    expect(next?.key).toBe('a')
  })

  it('개발사 담당 단계는 「지금 하실 일」에 절대 오르지 않는다', () => {
    const next = findNextClientStep([
      s({ status: 'pending', owner_side: 'agency', order_index: 1, key: 'agency' }),
      s({ status: 'pending', owner_side: 'client', order_index: 2, key: 'client' }),
    ])
    expect(next?.key).toBe('client')
  })

  it('both 담당은 의뢰인 몫으로 본다', () => {
    const next = findNextClientStep([s({ status: 'pending', owner_side: 'both', order_index: 1, key: 'domain' })])
    expect(next?.key).toBe('domain')
  })

  it('client_done·verified·skipped는 대상이 아니다', () => {
    expect(
      findNextClientStep([
        s({ status: 'client_done', owner_side: 'client', order_index: 1 }),
        s({ status: 'verified', owner_side: 'client', order_index: 2 }),
        s({ status: 'skipped', owner_side: 'client', order_index: 3 }),
      ]),
    ).toBeNull()
  })

  it('blocked는 다시 손봐야 하므로 대상이다', () => {
    const next = findNextClientStep([s({ status: 'blocked', owner_side: 'client', order_index: 1, key: 'stuck' })])
    expect(next?.key).toBe('stuck')
  })
})

describe('daysSince / isStalled', () => {
  const now = new Date('2026-08-21T00:00:00Z')

  it('경과 일수를 센다', () => {
    expect(daysSince('2026-08-18T00:00:00Z', now)).toBe(3)
  })

  it('활동 기록이 없으면 null', () => {
    expect(daysSince(null, now)).toBeNull()
  })

  it('7일 이상이면 정체로 본다', () => {
    expect(isStalled({ last_client_activity_at: '2026-08-14T00:00:00Z' }, now)).toBe(true)
    expect(isStalled({ last_client_activity_at: '2026-08-16T00:00:00Z' }, now)).toBe(false)
    expect(STALLED_THRESHOLD_DAYS).toBe(7)
  })
})
