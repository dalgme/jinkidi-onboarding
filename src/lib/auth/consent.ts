import type { ConsentKind } from '@/types/database'

/**
 * 동의 항목 — 설계 문서 14.2
 *
 * 마케팅 수신 동의는 «받지 않는다». 이 시스템은 계약 이행을 위한 업무 채널이라
 * 광고성 정보를 보낼 일이 없고, 동의를 받지 않으면 정통망법상 발송 의무·수신거부
 * 링크·발송 이력 관리 부담이 통째로 사라진다.
 */
export const CONSENT_VERSION = '2026-08-21'

export interface ConsentItem {
  kind: ConsentKind
  required: true
  /** 상세 조문을 볼 수 있는 경로. 없으면 링크를 노출하지 않는다 */
  href?: string
}

export const CONSENT_ITEMS: readonly ConsentItem[] = [
  { kind: 'age14', required: true },
  { kind: 'terms', required: true, href: '/terms' },
  { kind: 'privacy', required: true, href: '/privacy' },
  { kind: 'processing_delegation', required: true, href: '/privacy#delegation' },
] as const

export const CONSENT_KINDS: readonly ConsentKind[] = CONSENT_ITEMS.map((i) => i.kind)
