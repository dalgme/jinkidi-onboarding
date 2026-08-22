import { NextResponse, type NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { hashInviteToken } from '@/lib/auth/invite-token'
import { CONSENT_KINDS, CONSENT_VERSION } from '@/lib/auth/consent'

/**
 * 초대 수락 마무리 — 매직링크 인증이 끝난 뒤 호출된다.
 *
 *   1. 코드를 세션으로 교환
 *   2. client_members에 추가 (clients는 프로젝트 생성 시 이미 존재한다)
 *   3. project_members에 side='client'로 배정
 *   4. consents의 user_id를 실제 사용자에 연결
 *   5. project_invites.accepted_at 갱신
 *   6. audit_logs 기록
 *   7. /p/{code}로 리다이렉트
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const token = searchParams.get('token')
  const name = searchParams.get('name')
  const phone = searchParams.get('phone')

  if (!code || !token) {
    return NextResponse.redirect(`${origin}/login?error=invalid_invite`)
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_session`)
  }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('project_invites')
    .select('id, email, role, expires_at, accepted_at, revoked_at, project_id, projects(code, client_id, agency_id)')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle<{
      id: string
      email: string
      role: 'owner' | 'member'
      expires_at: string
      accepted_at: string | null
      revoked_at: string | null
      project_id: string
      projects: { code: string; client_id: string; agency_id: string } | null
    }>()

  if (!invite || invite.revoked_at || !invite.projects) {
    return NextResponse.redirect(`${origin}/login?error=invalid_invite`)
  }

  // 초대받은 주소로 인증한 사람만 수락할 수 있다.
  // 이 확인이 없으면 토큰을 얻은 제3자가 자기 계정으로 프로젝트에 들어온다.
  if ((user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.redirect(`${origin}/login?error=email_mismatch`)
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(`${origin}/invite/${token}`)
  }

  const alreadyAccepted = invite.accepted_at !== null

  const { error: memberError } = await admin.from('client_members').upsert(
    {
      client_id: invite.projects.client_id,
      user_id: user.id,
      role: invite.role,
      display_name: name,
      phone,
    },
    { onConflict: 'client_id,user_id' },
  )

  if (memberError) {
    console.error('[invite] failed to add client member', memberError.message)
    return NextResponse.redirect(`${origin}/login?error=member_failed`)
  }

  await admin
    .from('project_members')
    .upsert({ project_id: invite.project_id, user_id: user.id, side: 'client' }, { onConflict: 'project_id,user_id' })

  // 수락 화면에서 남긴 동의 이력(user_id가 비어 있음)을 이 사용자에게 연결한다.
  // consents는 append-only 트리거가 걸려 있으므로 새 행으로 남긴다.
  await admin.from('consents').insert(
    CONSENT_KINDS.map((kind) => ({
      user_id: user.id,
      email: invite.email,
      project_id: invite.project_id,
      kind,
      version: CONSENT_VERSION,
      agreed: true,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: request.headers.get('user-agent'),
    })),
  )

  if (!alreadyAccepted) {
    await admin
      .from('project_invites')
      .update({ accepted_at: new Date().toISOString(), accepted_user_id: user.id })
      .eq('id', invite.id)

    await admin.from('audit_logs').insert({
      agency_id: invite.projects.agency_id,
      project_id: invite.project_id,
      actor_user_id: user.id,
      actor_side: 'client',
      action: 'invite.accepted',
      meta: { email: invite.email, role: invite.role },
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: request.headers.get('user-agent'),
      client_visible: false,
    })
  }

  return NextResponse.redirect(`${origin}/p/${invite.projects.code}`)
}
