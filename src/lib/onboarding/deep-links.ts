import type { ProjectStep, VerifyType } from '@/types/database'

/**
 * 초대 화면 딥링크 생성기 — 설계 문서 5.3
 *
 * 「구현 30분, 문의 절반 감소」인 기능. 의뢰인을 설명 페이지가 아니라
 * «바로 그 화면»으로 보낸다.
 */

export type DeepLinkService = 'github' | 'vercel' | 'supabase'

export interface DeepLinkSpec {
  service: DeepLinkService
  /** projects 테이블에서 slug를 읽어올 컬럼 */
  slugField: 'github_org' | 'vercel_team_slug' | 'supabase_org_slug'
  buildUrl: (slug: string) => string
  /** 의뢰인이 지정해야 하는 역할 */
  role: string
  /** 조직 이름 입력란의 라벨 */
  slugLabel: string
  slugPlaceholder: string
}

export const DEEP_LINKS: Record<DeepLinkService, DeepLinkSpec> = {
  github: {
    service: 'github',
    slugField: 'github_org',
    buildUrl: (slug) => `https://github.com/orgs/${encodeURIComponent(slug)}/people`,
    role: 'Owner',
    slugLabel: 'GitHub Organization 이름',
    slugPlaceholder: 'my-company',
  },
  vercel: {
    service: 'vercel',
    slugField: 'vercel_team_slug',
    buildUrl: (slug) => `https://vercel.com/teams/${encodeURIComponent(slug)}/settings/members`,
    role: 'Member',
    slugLabel: 'Vercel Team 이름',
    slugPlaceholder: 'my-company',
  },
  supabase: {
    service: 'supabase',
    slugField: 'supabase_org_slug',
    buildUrl: (slug) => `https://supabase.com/dashboard/org/${encodeURIComponent(slug)}/team`,
    role: 'Administrator',
    slugLabel: 'Supabase Organization 이름',
    slugPlaceholder: 'my-company',
  },
}

const BY_VERIFY_TYPE: Partial<Record<VerifyType, DeepLinkService>> = {
  github_member: 'github',
  vercel_member: 'vercel',
  supabase_member: 'supabase',
}

/** 단계에 딸린 딥링크 사양. 도메인·수동 단계는 null */
export function deepLinkForStep(step: Pick<ProjectStep, 'verify_type' | 'key'>): DeepLinkSpec | null {
  const service = BY_VERIFY_TYPE[step.verify_type]
  return service ? DEEP_LINKS[service] : null
}

/** 단계가 도메인 입력을 요구하는지 */
export function requiresDomain(step: Pick<ProjectStep, 'verify_type'>): boolean {
  return step.verify_type === 'dns'
}
