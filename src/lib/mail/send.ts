import 'server-only'

import type { ReactElement } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { appUrl, getResend, isDryRun, mailFrom } from './resend'

/**
 * 메일 발송 + notifications 이력 기록 — 설계 문서 6.2
 *
 * ⚠ 메일 발송 실패가 사용자 액션 전체를 실패시키지 않도록 분리한다.
 *   단, 조용히 삼키지도 않는다 — notifications.error에 남기고 서버 로그에도 찍는다.
 */
export type MailType =
  | 'invite'
  | 'comment'
  | 'step_verified'
  | 'deliverable_shared'
  | 'reminder'
  | 'intake_submitted'
  | 'stalled_agency'

export interface SendMailInput {
  to: string
  subject: string
  react: ReactElement
  type: MailType
  projectId?: string | null
  userId?: string | null
  thresholdDays?: number | null
  meta?: Record<string, string | number | boolean | null>
}

export interface SendMailResult {
  ok: boolean
  error?: string
}

export async function sendMail(supabase: SupabaseClient, input: SendMailInput): Promise<SendMailResult> {
  let error: string | null = null

  try {
    if (isDryRun()) {
      console.info('[mail:dry-run]', { to: input.to, subject: input.subject, type: input.type })
    } else {
      const { error: resendError } = await getResend().emails.send({
        from: mailFrom(),
        to: input.to,
        subject: input.subject,
        react: input.react,
      })
      if (resendError) {
        error = resendError.message
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  if (error) {
    console.error('[mail] send failed', { to: input.to, type: input.type, error })
  }

  // 이력은 성공·실패 모두 남긴다. 「보냈다/안 왔다」 분쟁의 유일한 근거다.
  const { error: logError } = await supabase.from('notifications').insert({
    project_id: input.projectId ?? null,
    user_id: input.userId ?? null,
    to_email: input.to,
    type: input.type,
    channel: 'email',
    subject: input.subject,
    threshold_days: input.thresholdDays ?? null,
    sent_at: error ? null : new Date().toISOString(),
    error,
    meta: input.meta ?? {},
  })

  if (logError) {
    console.error('[mail] failed to record notification', logError.message)
  }

  return error ? { ok: false, error } : { ok: true }
}

export function portalUrl(code: string, path = ''): string {
  return `${appUrl()}/p/${code}${path}`
}

export function agencyProjectUrl(code: string, path = ''): string {
  return `${appUrl()}/app/projects/${code}${path}`
}

export function inviteUrl(token: string): string {
  return `${appUrl()}/invite/${token}`
}

export function optOutUrl(): string {
  return `${appUrl()}/settings/notifications`
}
