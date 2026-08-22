/**
 * 검증 결과는 «3상태»다 — 설계 문서 12.2 / CLAUDE.md §11
 *
 * 가장 위험한 버그는 토큰이 만료되어 401이 왔는데 화면에는 「미검증」으로만 뜨는 것이다.
 * 개발사는 의뢰인이 아직 안 한 줄 알고 리마인더를 보내고, 의뢰인은 「했다니까요」라고 답한다.
 *
 * error를 not_found로 뭉뚱그리지 않는다. 절대로.
 */
export type VerifyResult =
  | { status: 'verified'; detail: string; checkedAt: string }
  | { status: 'not_found'; detail: string; checkedAt: string }
  | { status: 'error'; error: string; checkedAt: string }

export const VERIFY_TIMEOUT_MS = 10_000

export function now(): string {
  return new Date().toISOString()
}

export function verified(detail: string): VerifyResult {
  return { status: 'verified', detail, checkedAt: now() }
}

export function notFound(detail: string): VerifyResult {
  return { status: 'not_found', detail, checkedAt: now() }
}

/**
 * 호출 실패. 사용자에게 보여줄 메시지와 로그용 메시지를 구분한다 —
 * 화면에는 원문을 그대로 노출해야 개발사가 「Bad credentials」를 보고 즉시 토큰 문제임을 안다.
 */
export function failed(error: string): VerifyResult {
  return { status: 'error', error, checkedAt: now() }
}

/** 예외를 error 결과로 변환. not_found로 바꾸지 않는다 */
export function fromException(e: unknown, context: string): VerifyResult {
  if (e instanceof DOMException && e.name === 'AbortError') {
    return failed(`${context}: 응답이 10초 안에 오지 않았습니다 (timeout)`)
  }
  const message = e instanceof Error ? e.message : String(e)
  return failed(`${context}: ${message}`)
}

/** 타임아웃이 걸린 fetch. 재시도하지 않는다 — 사용자가 다시 누르면 된다 */
export async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

/** 환경변수 누락은 error다 — 「아직 안 함」이 아니다 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`서버 환경변수 ${name}이(가) 설정되지 않았습니다`)
  }
  return value
}
