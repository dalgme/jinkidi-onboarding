import type { OwnerSide, ProjectStep, StepStatus } from '@/types/database'

/**
 * 진행률 계산 — 설계 문서 2.2.2 / CLAUDE.md §10
 *
 *   진행률 = (verified × 1.0 + client_done × 0.5) / 필수 단계 수
 *
 * client_done을 100%로 계산하면 검증이 무의미해진다.
 * 「초대했다」와 「실제로 초대됐다」는 다른 사실이다.
 */
const WEIGHT: Record<StepStatus, number> = {
  pending: 0,
  in_progress: 0,
  client_done: 0.5,
  verified: 1,
  blocked: 0,
  skipped: 0,
}

export interface ProgressInput {
  status: StepStatus
  is_required: boolean
}

export interface ProgressResult {
  /** 0–100 정수 */
  pct: number
  /** verified 처리된 필수 단계 수 */
  verified: number
  /** 진행률 분모 — skipped를 제외한 필수 단계 수 */
  total: number
}

export function calculateProgress(steps: readonly ProgressInput[]): ProgressResult {
  // skipped는 「해당 없음」이므로 분모에서 뺀다.
  // 분모에 남기면 도메인이 이미 있는 의뢰인의 진행률이 영원히 100%에 닿지 못한다.
  const required = steps.filter((s) => s.is_required && s.status !== 'skipped')
  const total = required.length

  if (total === 0) {
    return { pct: 100, verified: 0, total: 0 }
  }

  const weighted = required.reduce((sum, s) => sum + WEIGHT[s.status], 0)
  const verified = required.filter((s) => s.status === 'verified').length

  return {
    pct: Math.round((weighted / total) * 100),
    verified,
    total,
  }
}

/** 의뢰인 포털의 «지금 하실 일» — 항상 단 하나만 고른다 (설계 문서 5.2) */
export function findNextClientStep<T extends { status: StepStatus; owner_side: OwnerSide; order_index: number }>(
  steps: readonly T[],
): T | null {
  const actionable: StepStatus[] = ['pending', 'in_progress', 'blocked']

  const candidates = steps
    .filter((s) => s.owner_side === 'client' || s.owner_side === 'both')
    .filter((s) => actionable.includes(s.status))
    .slice()
    .sort((a, b) => a.order_index - b.order_index)

  return candidates[0] ?? null
}

/** 마지막 의뢰인 활동으로부터 지난 일수. 활동 기록이 없으면 null */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  return Math.floor((now.getTime() - then) / 86_400_000)
}

/** 정체 판정 — 7일 이상 의뢰인 활동 없음 (설계 문서 7.3) */
export const STALLED_THRESHOLD_DAYS = 7

export function isStalled(project: { last_client_activity_at: string | null }, now: Date = new Date()): boolean {
  const days = daysSince(project.last_client_activity_at, now)
  return days !== null && days >= STALLED_THRESHOLD_DAYS
}

export function summarizeSteps(steps: readonly ProjectStep[]) {
  return {
    progress: calculateProgress(steps),
    next: findNextClientStep(steps),
  }
}
