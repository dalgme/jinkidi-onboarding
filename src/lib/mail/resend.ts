import 'server-only'

import { Resend } from 'resend'

let cached: Resend | null = null

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not configured')
  if (!cached) cached = new Resend(key)
  return cached
}

export function mailFrom(): string {
  return process.env.MAIL_FROM ?? '온보딩 허브 <noreply@example.com>'
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/** 개발 환경에서는 실제 발송 대신 콘솔 출력 */
export function isDryRun(): boolean {
  if (process.env.MAIL_DRY_RUN === 'true') return true
  if (process.env.MAIL_DRY_RUN === 'false') return false
  return !process.env.RESEND_API_KEY
}
