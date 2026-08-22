'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { CONSENT_KINDS, CONSENT_VERSION } from '@/lib/auth/consent'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hashInviteToken } from '@/lib/auth/invite-token'
import { appUrl } from '@/lib/mail/resend'
import { ko } from '@/content/ko'

const acceptSchema = z.object({
  token: z.string().min(10),
  name: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  consents: z.array(z.enum(['age14', 'terms', 'privacy', 'processing_delegation'])),
})

export interface AcceptResult {
  ok: boolean
  message: string
}

/**
 * 초대 수락 — 설계 문서 3.3
 *
 * 이 단계에서는 아직 세션이 없다. 동의 이력을 «지금» 남긴 뒤 매직링크를 보내고,
 * 인증이 끝나면 콜백에서 실제 멤버 연결을 마무리한다.
 * 동의 시점과 인증 시점이 갈리는 것은 의도된 설계다 —
 * 동의는 사람이 체크한 그 순간의 사실이고, IP·User-Agent와 함께 그때 기록해야 한다.
 */
export async function acceptInvite(input: unknown): Promise<AcceptResult> {
  const parsed = acceptSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: ko.common.unknownError }
  }
  const { token, name, phone, consents } = parsed.data

  // 필수 동의 4건이 모두 있어야 한다. 서버에서 다시 확인한다.
  const missing = CONSENT_KINDS.filter((kind) => !consents.includes(kind))
  if (missing.length > 0) {
    return { ok: false, message: ko.invite.requiredNotice }
  }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('project_invites')
    .select('id, email, role, expires_at, accepted_at, revoked_at, project_id')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle<{
      id: string
      email: string
      role: 'owner' | 'member'
      expires_at: string
      accepted_at: string | null
      revoked_at: string | null
      project_id: string
    }>()

  if (!invite || invite.revoked_at || invite.accepted_at) {
    return { ok: false, message: ko.invite.invalidBody }
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, message: ko.invite.expiredBody }
  }

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip')
  const userAgent = h.get('user-agent')

  // 동의 이력 4건. INSERT만 가능한 테이블이므로 이후 수정·삭제되지 않는다.
  const { error: consentError } = await admin.from('consents').insert(
    CONSENT_KINDS.map((kind) => ({
      user_id: null,
      email: invite.email,
      project_id: invite.project_id,
      kind,
      version: CONSENT_VERSION,
      agreed: true,
      ip,
      user_agent: userAgent,
    })),
  )

  if (consentError) {
    console.error('[invite] failed to record consents', consentError.message)
    return { ok: false, message: ko.common.unknownError }
  }

  /*
   * 매직링크 인증 후 /invite/complete에서 멤버 연결을 마무리한다.
   * 이름·연락처는 redirectTo의 쿼리로 넘긴다 — 아직 세션이 없어 저장할 곳이 없고,
   * 링크는 본인 메일함으로만 가므로 제3자에게 노출되지 않는다.
   * accepted_at도 그 시점에 세팅한다 (인증되지 않은 수락은 수락이 아니다).
   */
  const supabase = await createClient()
  const redirectTo = new URL('/invite/complete', appUrl())
  redirectTo.searchParams.set('token', token)
  redirectTo.searchParams.set('name', name)
  if (phone) redirectTo.searchParams.set('phone', phone)

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: invite.email,
    options: { emailRedirectTo: redirectTo.toString() },
  })

  if (otpError) {
    return { ok: false, message: ko.auth.sendFailed }
  }

  return { ok: true, message: ko.invite.magicSent }
}

/** 만료 화면의 «새 링크 요청» — 개발사에게 알린다 */
export async function requestNewInviteLink(inviteId: string): Promise<AcceptResult> {
  const admin = createAdminClient()

  const { data: invite } = await admin
    .from('project_invites')
    .select('id, email, project_id, projects(name, code)')
    .eq('id', inviteId)
    .maybeSingle<{ id: string; email: string; project_id: string; projects: { name: string; code: string } | null }>()

  if (!invite) return { ok: false, message: ko.invite.invalidBody }

  await admin.from('audit_logs').insert({
    project_id: invite.project_id,
    actor_side: 'system',
    action: 'invite.sent',
    meta: { event: 'new_link_requested', email: invite.email },
  })

  return { ok: true, message: ko.invite.requested }
}
