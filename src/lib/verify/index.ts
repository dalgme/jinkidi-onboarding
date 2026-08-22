import 'server-only'

import type { Project, VerifyType } from '@/types/database'

import { verifyDns } from './dns'
import { verifyGithubMember } from './github'
import { verifySupabaseMember } from './supabase'
import { verifyVercelMember } from './vercel'
import { failed, type VerifyResult } from './types'

export type { VerifyResult } from './types'

/** verify_type별로 projects에서 읽어야 하는 컬럼 */
const SLUG_FIELD: Record<Exclude<VerifyType, 'manual'>, keyof Project> = {
  github_member: 'github_org',
  vercel_member: 'vercel_team_slug',
  supabase_member: 'supabase_org_slug',
  dns: 'primary_domain',
}

const MISSING_SLUG_MESSAGE: Record<Exclude<VerifyType, 'manual'>, string> = {
  github_member: 'GitHub Organization 이름이 아직 등록되지 않았습니다. 의뢰인이 조직을 만들고 이름을 입력해야 검증할 수 있습니다.',
  vercel_member: 'Vercel Team 이름이 아직 등록되지 않았습니다.',
  supabase_member: 'Supabase Organization 이름이 아직 등록되지 않았습니다.',
  dns: '도메인이 아직 등록되지 않았습니다.',
}

export function isAutomatable(verifyType: VerifyType): verifyType is Exclude<VerifyType, 'manual'> {
  return verifyType !== 'manual'
}

/**
 * 프로젝트에 저장된 slug로 해당 검증을 실행한다.
 * slug가 없으면 error다 — 「아직 안 함」이 아니라 「확인할 수 없음」이기 때문이다.
 */
export async function runVerification(verifyType: VerifyType, project: Project): Promise<VerifyResult> {
  if (!isAutomatable(verifyType)) {
    return failed('이 단계는 자동 검증 대상이 아닙니다.')
  }

  const value = project[SLUG_FIELD[verifyType]]
  if (typeof value !== 'string' || value.trim() === '') {
    return failed(MISSING_SLUG_MESSAGE[verifyType])
  }

  switch (verifyType) {
    case 'github_member':
      return verifyGithubMember(value)
    case 'vercel_member':
      return verifyVercelMember(value)
    case 'supabase_member':
      return verifySupabaseMember(value)
    case 'dns':
      return verifyDns(value)
  }
}
