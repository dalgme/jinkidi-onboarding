import 'server-only'

import dns from 'node:dns/promises'

import { failed, notFound, verified, VERIFY_TIMEOUT_MS, type VerifyResult } from './types'

/**
 * DNS 검증 — 설계 문서 12.2
 *   CNAME 또는 A 레코드가 Vercel을 가리키면 verified
 *
 * 「도메인은 샀지만 DNS를 아직 안 걸었다」와 「등록 자체가 안 되어 있다」는 다르다.
 * 전자는 not_found, 후자(조회 실패·서버 오류)도 not_found로 볼 수 있는 경우와
 * error인 경우를 NXDOMAIN 여부로 나눈다.
 */
const DEFAULT_TARGETS = ['cname.vercel-dns.com', '76.76.21.21']

function targets(): string[] {
  const raw = process.env.VERCEL_DNS_TARGETS
  if (!raw) return DEFAULT_TARGETS
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
}

export async function verifyDns(domain: string): Promise<VerifyResult> {
  const expected = targets()
  const cnameTargets = expected.filter((t) => !/^\d+\.\d+\.\d+\.\d+$/.test(t))
  const aTargets = expected.filter((t) => /^\d+\.\d+\.\d+\.\d+$/.test(t))

  const found: string[] = []
  const softErrors: string[] = []

  const cnames = await lookup(() => dns.resolveCname(domain), softErrors, 'CNAME')
  found.push(...cnames.map((c) => c.toLowerCase().replace(/\.$/, '')))

  const records = await lookup(() => dns.resolve4(domain), softErrors, 'A')
  found.push(...records)

  if (found.length === 0) {
    // 조회 자체가 실패했고 그 원인이 「없음」이 아니면 error다
    const hard = softErrors.filter((e) => !e.includes('ENOTFOUND') && !e.includes('ENODATA') && !e.includes('NXDOMAIN'))
    if (hard.length > 0) {
      return failed(`DNS 조회 실패 — ${hard.join(' / ')}`)
    }
    return notFound(`${domain}에 대한 CNAME·A 레코드를 찾지 못했습니다. 도메인 등록 직후라면 반영에 최대 24시간이 걸립니다.`)
  }

  const matchedCname = found.find((f) => cnameTargets.some((t) => f === t || f.endsWith(`.${t}`)))
  const matchedA = found.find((f) => aTargets.includes(f))
  const matched = matchedCname ?? matchedA

  if (matched) {
    return verified(`${domain}이(가) Vercel을 가리키고 있습니다 (${matched})`)
  }

  return notFound(`${domain}은(는) 현재 ${found.join(', ')} 을(를) 가리킵니다. Vercel 대상(${expected.join(', ')})으로 변경이 필요합니다.`)
}

async function lookup(fn: () => Promise<string[]>, errors: string[], label: string): Promise<string[]> {
  try {
    return await withTimeout(fn(), VERIFY_TIMEOUT_MS)
  } catch (e) {
    const code = e instanceof Error && 'code' in e ? String((e as { code: unknown }).code) : ''
    errors.push(`${label} ${code || (e instanceof Error ? e.message : String(e))}`)
    return []
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`ETIMEDOUT after ${ms}ms`)), ms)),
  ])
}
