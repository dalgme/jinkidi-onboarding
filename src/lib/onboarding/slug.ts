/**
 * 조직 slug 정규화 — 설계 문서 5.3
 *
 * 의뢰인에게 «조직 이름만 입력하세요»라고 안내해도, 실제로는 브라우저 주소창을
 * 통째로 복사해 붙여넣는다. 이 함수가 없으면 딥링크가 깨지고 검증도 실패한다.
 *
 *   https://github.com/orgs/acme-corp/people  →  acme-corp
 *   @acme-corp                                →  acme-corp
 *   "  Acme-Corp  "                           →  acme-corp
 */

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

interface UrlRule {
  host: RegExp
  /** 경로 세그먼트 중 slug 앞에 오는 표지. 없으면 첫 세그먼트를 쓴다 */
  after?: string[]
}

const URL_RULES: Record<'github' | 'vercel' | 'supabase', UrlRule> = {
  github: { host: /(^|\.)github\.com$/i, after: ['orgs', 'organizations'] },
  vercel: { host: /(^|\.)vercel\.com$/i, after: ['teams'] },
  supabase: { host: /(^|\.)supabase\.(com|io)$/i, after: ['org', 'dashboard'] },
}

export type SlugKind = keyof typeof URL_RULES

function fromUrl(raw: string, kind: SlugKind): string | null {
  let url: URL
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const rule = URL_RULES[kind]
  if (!rule.host.test(url.hostname)) return null

  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  for (const marker of rule.after ?? []) {
    const at = segments.indexOf(marker)
    if (at !== -1 && at + 1 < segments.length) {
      return segments[at + 1] ?? null
    }
  }

  return segments[0] ?? null
}

/**
 * 입력값에서 조직 slug를 추출한다. 알아볼 수 없으면 null.
 * null을 반환하는 경우 화면에서 다시 입력을 요청해야 한다 — 조용히 빈 값을 저장하면
 * 딥링크가 깨진 채로 의뢰인이 방치된다.
 */
export function normalizeOrgSlug(input: string, kind: SlugKind): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const looksLikeUrl = trimmed.includes('/') || trimmed.includes('://')
  const candidate = looksLikeUrl ? fromUrl(trimmed, kind) : trimmed.replace(/^@/, '')

  if (!candidate) return null

  const normalized = candidate.trim().toLowerCase().replace(/^@/, '')
  return SLUG_PATTERN.test(normalized) ? normalized : null
}

/**
 * 도메인 정규화. 프로토콜·www·경로·포트를 걷어내고 호스트만 남긴다.
 *   https://www.mycompany.com/  →  mycompany.com
 */
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null

  let host = trimmed
  if (host.includes('/') || host.includes('://')) {
    try {
      host = new URL(host.includes('://') ? host : `https://${host}`).hostname
    } catch {
      return null
    }
  }

  host = host.replace(/^www\./, '').replace(/\.$/, '').split(':')[0] ?? ''

  // 최소한 «something.tld» 형태여야 한다
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    return null
  }
  return host
}

/** 프로젝트 code 후보 생성. 한국어 프로젝트명에서도 쓸 수 있는 코드를 만든다 */
export function suggestProjectCode(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return ascii.slice(0, 40)
}

export const PROJECT_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
