import 'server-only'

import { failed, fetchWithTimeout, fromException, notFound, requireEnv, verified, type VerifyResult } from './types'

/**
 * Supabase Organization 멤버 검증 — 설계 문서 12.2
 *   GET https://api.supabase.com/v1/organizations/{slug}/members
 *   개발사 이메일이 목록에 포함  →  verified
 */
export async function verifySupabaseMember(orgSlug: string): Promise<VerifyResult> {
  let token: string
  let agencyEmail: string
  try {
    token = requireEnv('SUPABASE_MGMT_TOKEN')
    agencyEmail = requireEnv('SUPABASE_AGENCY_EMAIL')
  } catch (e) {
    return fromException(e, 'Supabase')
  }

  const url = `https://api.supabase.com/v1/organizations/${encodeURIComponent(orgSlug)}/members`

  try {
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 404) {
      return notFound(`${orgSlug} 조직을 찾을 수 없습니다. 조직 이름이 정확한지 확인해주세요.`)
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return failed(`Supabase Management API ${res.status}: ${body.slice(0, 400) || res.statusText}`)
    }

    const json: unknown = await res.json()
    const members = extractMembers(json)

    if (members === null) {
      return failed(`Supabase 응답에서 멤버 목록을 찾을 수 없습니다: ${JSON.stringify(json).slice(0, 200)}`)
    }

    const target = agencyEmail.toLowerCase()
    const found = members.find((m) => m.email?.toLowerCase() === target)

    if (found) {
      return verified(`${orgSlug} 조직의 멤버로 확인되었습니다 (${found.role_name ?? 'member'})`)
    }

    return notFound(`${orgSlug} 조직에 개발사 계정(${agencyEmail})이 아직 없습니다.`)
  } catch (e) {
    return fromException(e, 'Supabase')
  }
}

interface SupabaseOrgMember {
  email?: string
  role_name?: string
}

function extractMembers(json: unknown): SupabaseOrgMember[] | null {
  if (!Array.isArray(json)) return null

  const members: SupabaseOrgMember[] = []
  for (const item of json) {
    if (typeof item === 'object' && item !== null) {
      const email = 'email' in item ? (item as { email: unknown }).email : undefined
      const roleName = 'role_name' in item ? (item as { role_name: unknown }).role_name : undefined
      members.push({
        email: typeof email === 'string' ? email : undefined,
        role_name: typeof roleName === 'string' ? roleName : undefined,
      })
    }
  }
  return members
}
