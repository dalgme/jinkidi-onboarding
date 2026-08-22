import { describe, expect, it } from 'vitest'

import { idleDaysOf, REMINDER_THRESHOLDS, STOP_AFTER_DAYS, thresholdFor } from '@/lib/mail/reminders'
import type { Project } from '@/types/database'

describe('thresholdFor', () => {
  it('임계값은 3·7·14일이다', () => {
    expect(REMINDER_THRESHOLDS).toEqual([3, 7, 14])
  })

  it('도달한 임계값 중 가장 큰 것을 고른다', () => {
    expect(thresholdFor(0)).toBeNull()
    expect(thresholdFor(2)).toBeNull()
    expect(thresholdFor(3)).toBe(3)
    expect(thresholdFor(5)).toBe(3)
    expect(thresholdFor(7)).toBe(7)
    expect(thresholdFor(13)).toBe(7)
    expect(thresholdFor(14)).toBe(14)
    expect(thresholdFor(40)).toBe(14)
  })

  it('14일에서 멈춘다 — 무한 리마인더는 스팸이 된다', () => {
    expect(STOP_AFTER_DAYS).toBe(14)
    // 14일을 넘긴 뒤에도 임계값 자체는 14로 고정되므로,
    // notifications 이력 검사가 재발송을 한 번으로 막는다
    expect(thresholdFor(15)).toBe(14)
    expect(thresholdFor(100)).toBe(14)
  })
})

describe('idleDaysOf', () => {
  const now = new Date('2026-08-21T00:00:00Z')

  function project(overrides: Partial<Project>): Project {
    return {
      last_client_activity_at: null,
      started_at: null,
      created_at: '2026-08-01T00:00:00Z',
      ...overrides,
    } as Project
  }

  it('마지막 의뢰인 활동일부터 센다', () => {
    expect(idleDaysOf(project({ last_client_activity_at: '2026-08-18T00:00:00Z' }), now)).toBe(3)
  })

  it('활동이 없으면 시작일로 센다', () => {
    expect(idleDaysOf(project({ started_at: '2026-08-14T00:00:00Z' }), now)).toBe(7)
  })

  it('시작일도 없으면 생성일로 센다', () => {
    expect(idleDaysOf(project({}), now)).toBe(20)
  })
})
