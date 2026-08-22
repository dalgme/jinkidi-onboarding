import type { OwnerSide, Side, StepStatus } from '@/types/database'

/**
 * 상태 전이 가드 — 설계 문서 2.2.2 / CLAUDE.md §10
 *
 * 이 모듈은 «화면과 서버 액션»의 1차 방어선이다.
 * 최종 방어선은 RLS의 WITH CHECK 절과 트리거다 (20260821000300_rls_policies.sql).
 * 둘 중 하나만 두지 않는다 — 화면 가드만 두면 API 직접 호출로 뚫리고,
 * DB 가드만 두면 사용자에게 알아볼 수 있는 오류를 줄 수 없다.
 */

/** 의뢰인이 만들 수 있는 상태. verified·skipped는 여기 없다 */
export const CLIENT_ALLOWED_STATUSES: readonly StepStatus[] = ['in_progress', 'client_done', 'blocked']

/** 개발사는 전 상태로 변경할 수 있다 */
export const AGENCY_ALLOWED_STATUSES: readonly StepStatus[] = [
  'pending',
  'in_progress',
  'client_done',
  'verified',
  'blocked',
  'skipped',
]

export type TransitionDenyReason =
  | 'not_allowed_for_side'
  | 'step_not_owned_by_client'
  | 'already_settled'
  | 'blocked_reason_required'

export interface TransitionCheck {
  side: Side
  ownerSide: OwnerSide
  from: StepStatus
  to: StepStatus
  blockedReason?: string | null
}

export type TransitionVerdict = { ok: true } | { ok: false; reason: TransitionDenyReason }

export function canTransition({ side, ownerSide, from, to, blockedReason }: TransitionCheck): TransitionVerdict {
  if (to === 'blocked' && (!blockedReason || blockedReason.trim().length === 0)) {
    return { ok: false, reason: 'blocked_reason_required' }
  }

  if (side === 'agency') {
    return AGENCY_ALLOWED_STATUSES.includes(to) ? { ok: true } : { ok: false, reason: 'not_allowed_for_side' }
  }

  // 이하 의뢰인
  if (!CLIENT_ALLOWED_STATUSES.includes(to)) {
    return { ok: false, reason: 'not_allowed_for_side' }
  }

  if (ownerSide === 'agency') {
    return { ok: false, reason: 'step_not_owned_by_client' }
  }

  // 개발사가 이미 확인했거나 제외한 단계를 의뢰인이 되돌릴 수 없다
  if (from === 'verified' || from === 'skipped') {
    return { ok: false, reason: 'already_settled' }
  }

  return { ok: true }
}

/** 전이에 맞춰 함께 갱신해야 하는 타임스탬프 컬럼 */
export function transitionTimestamps(to: StepStatus, now: string = new Date().toISOString()) {
  return {
    client_done_at: to === 'client_done' ? now : null,
    ...(to === 'verified' ? {} : { verified_at: null, verified_by: null }),
    blocked_reason: to === 'blocked' ? undefined : null,
  }
}
