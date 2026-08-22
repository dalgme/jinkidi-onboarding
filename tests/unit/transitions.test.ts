import { describe, expect, it } from 'vitest'

import { canTransition, CLIENT_ALLOWED_STATUSES } from '@/lib/onboarding/transitions'
import type { StepStatus } from '@/types/database'

describe('canTransition — 의뢰인', () => {
  const base = { side: 'client', ownerSide: 'client', from: 'pending' } as const

  it('in_progress / client_done / blocked 로는 바꿀 수 있다', () => {
    expect(canTransition({ ...base, to: 'in_progress' })).toEqual({ ok: true })
    expect(canTransition({ ...base, to: 'client_done' })).toEqual({ ok: true })
    expect(canTransition({ ...base, to: 'blocked', blockedReason: '카드가 거부됩니다' })).toEqual({ ok: true })
  })

  it('verified로는 절대 바꿀 수 없다 — 이 가드가 검증의 존재 이유다', () => {
    const verdict = canTransition({ ...base, to: 'verified' })
    expect(verdict).toEqual({ ok: false, reason: 'not_allowed_for_side' })
  })

  it('skipped로도 바꿀 수 없다', () => {
    expect(canTransition({ ...base, to: 'skipped' })).toEqual({ ok: false, reason: 'not_allowed_for_side' })
  })

  it('개발사 담당 단계는 건드릴 수 없다', () => {
    expect(canTransition({ ...base, ownerSide: 'agency', to: 'client_done' })).toEqual({
      ok: false,
      reason: 'step_not_owned_by_client',
    })
  })

  it('both 담당 단계는 건드릴 수 있다', () => {
    expect(canTransition({ ...base, ownerSide: 'both', to: 'client_done' })).toEqual({ ok: true })
  })

  it('이미 verified·skipped된 단계를 되돌릴 수 없다', () => {
    expect(canTransition({ ...base, from: 'verified', to: 'in_progress' })).toEqual({
      ok: false,
      reason: 'already_settled',
    })
    expect(canTransition({ ...base, from: 'skipped', to: 'in_progress' })).toEqual({
      ok: false,
      reason: 'already_settled',
    })
  })

  it('허용 목록에 verified·skipped가 없다', () => {
    expect(CLIENT_ALLOWED_STATUSES).not.toContain('verified' as StepStatus)
    expect(CLIENT_ALLOWED_STATUSES).not.toContain('skipped' as StepStatus)
  })
})

describe('canTransition — 개발사', () => {
  const base = { side: 'agency', ownerSide: 'client', from: 'client_done' } as const

  it('전 상태로 바꿀 수 있다', () => {
    for (const to of ['pending', 'in_progress', 'client_done', 'verified', 'skipped'] as StepStatus[]) {
      expect(canTransition({ ...base, to })).toEqual({ ok: true })
    }
  })

  it('개발사 담당 단계도 바꿀 수 있다', () => {
    expect(canTransition({ ...base, ownerSide: 'agency', to: 'verified' })).toEqual({ ok: true })
  })

  it('verified된 단계를 되돌릴 수 있다 (오검증 정정)', () => {
    expect(canTransition({ ...base, from: 'verified', to: 'in_progress' })).toEqual({ ok: true })
  })
})

describe('blocked 사유 강제', () => {
  it('사유 없이 blocked로 갈 수 없다 — 양쪽 모두', () => {
    for (const side of ['client', 'agency'] as const) {
      expect(canTransition({ side, ownerSide: 'client', from: 'pending', to: 'blocked' })).toEqual({
        ok: false,
        reason: 'blocked_reason_required',
      })
      expect(
        canTransition({ side, ownerSide: 'client', from: 'pending', to: 'blocked', blockedReason: '   ' }),
      ).toEqual({ ok: false, reason: 'blocked_reason_required' })
    }
  })
})
