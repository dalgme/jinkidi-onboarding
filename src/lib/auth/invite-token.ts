import 'server-only'

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * 초대 토큰 — 원문을 DB에 저장하지 않는다. 해시만 저장한다.
 * DB가 유출되어도 초대 링크를 재구성할 수 없어야 한다.
 */
export const INVITE_TTL_DAYS = 14

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashInviteToken(token) }
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 해시 비교는 상수 시간으로 */
export function inviteTokenMatches(token: string, storedHash: string): boolean {
  const computed = Buffer.from(hashInviteToken(token), 'hex')
  let stored: Buffer
  try {
    stored = Buffer.from(storedHash, 'hex')
  } catch {
    return false
  }
  if (computed.length !== stored.length) return false
  return timingSafeEqual(computed, stored)
}

export function inviteExpiryDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 86_400_000)
}
