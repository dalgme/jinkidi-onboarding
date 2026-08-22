import 'server-only'

import { failed, fetchWithTimeout, fromException, notFound, requireEnv, verified, type VerifyResult } from './types'

/**
 * GitHub Organization 멤버십 검증 — 설계 문서 12.2
 *   GET /orgs/{org}/memberships/{username}
 *   200 && state === 'active'  →  verified
 *   404                        →  not_found
 *   그 외                       →  error
 */
export async function verifyGithubMember(org: string): Promise<VerifyResult> {
  let token: string
  let username: string
  try {
    token = requireEnv('GITHUB_TOKEN')
    username = requireEnv('GITHUB_AGENCY_USERNAME')
  } catch (e) {
    return fromException(e, 'GitHub')
  }

  const url = `https://api.github.com/orgs/${encodeURIComponent(org)}/memberships/${encodeURIComponent(username)}`

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (res.status === 404) {
      return notFound(`${org} 조직에서 ${username} 계정을 찾을 수 없습니다. 아직 초대되지 않았거나 초대를 수락하지 않은 상태입니다.`)
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // 401·403은 개발사 토큰 문제다. 의뢰인이 안 한 것으로 보이면 안 된다.
      return failed(`GitHub API ${res.status}: ${body.slice(0, 400) || res.statusText}`)
    }

    const json: unknown = await res.json()
    const state = extractState(json)

    if (state === 'active') {
      return verified(`${org} 조직의 활성 멤버로 확인되었습니다 (${username})`)
    }
    if (state === 'pending') {
      return notFound(`초대는 되었으나 ${username} 계정이 아직 수락하지 않았습니다.`)
    }
    return failed(`GitHub 응답의 state 값을 해석할 수 없습니다: ${JSON.stringify(json).slice(0, 200)}`)
  } catch (e) {
    return fromException(e, 'GitHub')
  }
}

function extractState(json: unknown): string | null {
  if (typeof json === 'object' && json !== null && 'state' in json) {
    const state = (json as { state: unknown }).state
    return typeof state === 'string' ? state : null
  }
  return null
}
