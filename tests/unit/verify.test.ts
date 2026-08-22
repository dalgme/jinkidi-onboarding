import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 검증 3상태 계약 검사 — 이 프로젝트에서 가장 중요한 단위 테스트다.
 *
 * error를 not_found로 뭉뚱그리면 개발사는 토큰 만료를 「의뢰인이 아직 안 함」으로
 * 오인해 리마인더를 보내고, 의뢰인은 「했다니까요」라고 답한다.
 */

const ORIGINAL_ENV = { ...process.env }

function mockFetch(response: { status: number; body?: unknown; text?: string }) {
  return vi.fn().mockResolvedValue({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: `status ${response.status}`,
    json: async () => response.body,
    text: async () => response.text ?? JSON.stringify(response.body ?? {}),
  })
}

beforeEach(() => {
  vi.resetModules()
  process.env = {
    ...ORIGINAL_ENV,
    GITHUB_TOKEN: 'gh-token',
    GITHUB_AGENCY_USERNAME: 'agency-dev',
    VERCEL_TOKEN: 'vercel-token',
    VERCEL_AGENCY_USER_ID: 'uid-agency',
    SUPABASE_MGMT_TOKEN: 'sb-token',
    SUPABASE_AGENCY_EMAIL: 'dev@agency.example',
  }
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.unstubAllGlobals()
})

describe('verifyGithubMember', () => {
  it('state === active 이면 verified', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 200, body: { state: 'active' } }))
    const { verifyGithubMember } = await import('@/lib/verify/github')

    const result = await verifyGithubMember('acme-corp')
    expect(result.status).toBe('verified')
  })

  it('404는 not_found — 아직 초대되지 않은 상태다', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 404 }))
    const { verifyGithubMember } = await import('@/lib/verify/github')

    const result = await verifyGithubMember('acme-corp')
    expect(result.status).toBe('not_found')
  })

  it('state === pending은 not_found — 초대는 갔지만 수락하지 않았다', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 200, body: { state: 'pending' } }))
    const { verifyGithubMember } = await import('@/lib/verify/github')

    const result = await verifyGithubMember('acme-corp')
    expect(result.status).toBe('not_found')
  })

  it('401은 error다 — 절대 not_found로 뭉뚱그리지 않는다', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 401, text: '{"message":"Bad credentials"}' }))
    const { verifyGithubMember } = await import('@/lib/verify/github')

    const result = await verifyGithubMember('acme-corp')
    expect(result.status).toBe('error')
    // 오류 원문이 그대로 보여야 개발사가 즉시 토큰 문제임을 안다
    expect(result.status === 'error' && result.error).toContain('Bad credentials')
  })

  it('403(권한 부족)도 error다', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 403, text: 'Resource not accessible' }))
    const { verifyGithubMember } = await import('@/lib/verify/github')

    expect((await verifyGithubMember('acme-corp')).status).toBe('error')
  })

  it('환경변수가 없으면 error다 — 「의뢰인이 안 함」이 아니다', async () => {
    delete process.env.GITHUB_TOKEN
    vi.stubGlobal('fetch', mockFetch({ status: 200, body: { state: 'active' } }))
    const { verifyGithubMember } = await import('@/lib/verify/github')

    const result = await verifyGithubMember('acme-corp')
    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error).toContain('GITHUB_TOKEN')
  })

  it('네트워크 예외도 error다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')))
    const { verifyGithubMember } = await import('@/lib/verify/github')

    const result = await verifyGithubMember('acme-corp')
    expect(result.status).toBe('error')
    expect(result.status === 'error' && result.error).toContain('ECONNRESET')
  })
})

describe('verifyVercelMember', () => {
  it('개발사 uid가 목록에 있으면 verified', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 200, body: { members: [{ uid: 'uid-agency', role: 'MEMBER' }] } }))
    const { verifyVercelMember } = await import('@/lib/verify/vercel')

    expect((await verifyVercelMember('acme-team')).status).toBe('verified')
  })

  it('목록에 없으면 not_found', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 200, body: { members: [{ uid: 'uid-other' }] } }))
    const { verifyVercelMember } = await import('@/lib/verify/vercel')

    expect((await verifyVercelMember('acme-team')).status).toBe('not_found')
  })

  it('403은 error다', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 403, text: 'Forbidden' }))
    const { verifyVercelMember } = await import('@/lib/verify/vercel')

    expect((await verifyVercelMember('acme-team')).status).toBe('error')
  })

  it('응답 형태가 예상과 다르면 error다 — 조용히 not_found로 넘기지 않는다', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 200, body: { unexpected: true } }))
    const { verifyVercelMember } = await import('@/lib/verify/vercel')

    expect((await verifyVercelMember('acme-team')).status).toBe('error')
  })
})

describe('verifySupabaseMember', () => {
  it('개발사 이메일이 목록에 있으면 verified (대소문자 무시)', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ status: 200, body: [{ email: 'DEV@Agency.example', role_name: 'Administrator' }] }),
    )
    const { verifySupabaseMember } = await import('@/lib/verify/supabase')

    expect((await verifySupabaseMember('acme-org')).status).toBe('verified')
  })

  it('없으면 not_found', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 200, body: [{ email: 'someone@else.example' }] }))
    const { verifySupabaseMember } = await import('@/lib/verify/supabase')

    expect((await verifySupabaseMember('acme-org')).status).toBe('not_found')
  })

  it('500은 error다', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 500, text: 'Internal Server Error' }))
    const { verifySupabaseMember } = await import('@/lib/verify/supabase')

    expect((await verifySupabaseMember('acme-org')).status).toBe('error')
  })
})

describe('runVerification', () => {
  const project = {
    id: 'p1',
    github_org: null,
    vercel_team_slug: null,
    supabase_org_slug: null,
    primary_domain: null,
  }

  it('slug가 없으면 error다 — 「확인할 수 없음」이지 「아직 안 함」이 아니다', async () => {
    const { runVerification } = await import('@/lib/verify')

    // 타입 단언 없이 필요한 필드만 갖춘 객체를 넘긴다
    const result = await runVerification('github_member', project as never)
    expect(result.status).toBe('error')
  })

  it('manual 단계는 자동 검증 대상이 아니다', async () => {
    const { runVerification } = await import('@/lib/verify')

    expect((await runVerification('manual', project as never)).status).toBe('error')
  })
})
