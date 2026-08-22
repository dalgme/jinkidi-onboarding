import { describe, expect, it } from 'vitest'

import { normalizeDomain, normalizeOrgSlug, PROJECT_CODE_PATTERN, suggestProjectCode } from '@/lib/onboarding/slug'

describe('normalizeOrgSlug', () => {
  it('조직 이름을 그대로 받는다', () => {
    expect(normalizeOrgSlug('acme-corp', 'github')).toBe('acme-corp')
  })

  it('주소창을 통째로 붙여넣어도 slug를 뽑아낸다 — 실제로 이렇게 붙여넣는다', () => {
    expect(normalizeOrgSlug('https://github.com/orgs/acme-corp/people', 'github')).toBe('acme-corp')
    expect(normalizeOrgSlug('github.com/orgs/acme-corp/people', 'github')).toBe('acme-corp')
    expect(normalizeOrgSlug('https://vercel.com/teams/acme-corp/settings/members', 'vercel')).toBe('acme-corp')
    expect(normalizeOrgSlug('https://supabase.com/dashboard/org/acme-corp/team', 'supabase')).toBe('acme-corp')
  })

  it('@ 접두·공백·대문자를 정리한다', () => {
    expect(normalizeOrgSlug('@acme-corp', 'github')).toBe('acme-corp')
    expect(normalizeOrgSlug('  Acme-Corp  ', 'github')).toBe('acme-corp')
    expect(normalizeOrgSlug('ACME', 'github')).toBe('acme')
  })

  it('GitHub 조직 최상위 주소도 처리한다', () => {
    expect(normalizeOrgSlug('https://github.com/acme-corp', 'github')).toBe('acme-corp')
  })

  it('알아볼 수 없으면 null을 준다 — 조용히 빈 값을 저장하면 딥링크가 깨진다', () => {
    expect(normalizeOrgSlug('', 'github')).toBeNull()
    expect(normalizeOrgSlug('   ', 'github')).toBeNull()
    expect(normalizeOrgSlug('한국어조직', 'github')).toBeNull()
    expect(normalizeOrgSlug('has space', 'github')).toBeNull()
    expect(normalizeOrgSlug('-leading', 'github')).toBeNull()
    expect(normalizeOrgSlug('trailing-', 'github')).toBeNull()
  })

  it('다른 서비스의 URL을 붙여넣으면 거부한다', () => {
    expect(normalizeOrgSlug('https://github.com/orgs/acme/people', 'vercel')).toBeNull()
  })
})

describe('normalizeDomain', () => {
  it('프로토콜·www·경로를 걷어낸다', () => {
    expect(normalizeDomain('https://www.mycompany.com/')).toBe('mycompany.com')
    expect(normalizeDomain('MyCompany.com')).toBe('mycompany.com')
    expect(normalizeDomain('http://shop.mycompany.co.kr/products')).toBe('shop.mycompany.co.kr')
  })

  it('도메인이 아닌 값은 거부한다', () => {
    expect(normalizeDomain('mycompany')).toBeNull()
    expect(normalizeDomain('')).toBeNull()
    expect(normalizeDomain('한글.com')).toBeNull()
  })
})

describe('suggestProjectCode', () => {
  it('영문 프로젝트명에서 kebab-case 코드를 만든다', () => {
    expect(suggestProjectCode('Acme Shop Renewal')).toBe('acme-shop-renewal')
  })

  it('한국어만 있으면 빈 문자열 — 사용자가 직접 입력해야 한다', () => {
    expect(suggestProjectCode('달그미 온보딩')).toBe('')
  })

  it('만들어진 코드는 code 패턴을 만족한다', () => {
    const code = suggestProjectCode('Acme  Shop__Renewal!!')
    expect(PROJECT_CODE_PATTERN.test(code)).toBe(true)
  })
})
