import 'server-only'

import { failed, fetchWithTimeout, fromException, notFound, requireEnv, verified, type VerifyResult } from './types'

/**
 * Vercel Team 멤버 검증 — 설계 문서 12.2
 *   GET /v2/teams/{teamIdOrSlug}/members
 *   개발사 uid가 목록에 포함  →  verified
 */
export async function verifyVercelMember(teamSlug: string): Promise<VerifyResult> {
  let token: string
  let agencyUserId: string
  try {
    token = requireEnv('VERCEL_TOKEN')
    agencyUserId = requireEnv('VERCEL_AGENCY_USER_ID')
  } catch (e) {
    return fromException(e, 'Vercel')
  }

  const url = `https://api.vercel.com/v2/teams/${encodeURIComponent(teamSlug)}/members?limit=100`

  try {
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (res.status === 404) {
      return notFound(`${teamSlug} 팀을 찾을 수 없습니다. 팀 이름이 정확한지 확인해주세요.`)
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return failed(`Vercel API ${res.status}: ${body.slice(0, 400) || res.statusText}`)
    }

    const json: unknown = await res.json()
    const members = extractMembers(json)

    if (members === null) {
      return failed(`Vercel 응답에서 멤버 목록을 찾을 수 없습니다: ${JSON.stringify(json).slice(0, 200)}`)
    }

    const found = members.find((m) => m.uid === agencyUserId)
    if (found) {
      return verified(`${teamSlug} 팀의 멤버로 확인되었습니다 (${found.role ?? 'member'})`)
    }

    return notFound(`${teamSlug} 팀에 개발사 계정이 아직 없습니다. 초대 후 수락까지 완료되어야 합니다.`)
  } catch (e) {
    return fromException(e, 'Vercel')
  }
}

interface VercelMember {
  uid: string
  role?: string
}

function extractMembers(json: unknown): VercelMember[] | null {
  if (typeof json !== 'object' || json === null || !('members' in json)) return null
  const raw = (json as { members: unknown }).members
  if (!Array.isArray(raw)) return null

  const members: VercelMember[] = []
  for (const item of raw) {
    if (typeof item === 'object' && item !== null && 'uid' in item) {
      const uid = (item as { uid: unknown }).uid
      const role = 'role' in item ? (item as { role: unknown }).role : undefined
      if (typeof uid === 'string') {
        members.push({ uid, role: typeof role === 'string' ? role : undefined })
      }
    }
  }
  return members
}
