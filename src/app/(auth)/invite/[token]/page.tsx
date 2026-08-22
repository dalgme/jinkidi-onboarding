import type { Metadata } from 'next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ko } from '@/content/ko'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashInviteToken } from '@/lib/auth/invite-token'

import { InviteAcceptForm } from './invite-form'
import { RequestNewLinkButton } from './request-new-link'

export const metadata: Metadata = { title: ko.invite.title }

interface InviteLookup {
  id: string
  email: string
  role: 'owner' | 'member'
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  project_id: string
  projects: { name: string; code: string; agencies: { name: string } | null } | null
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  /*
   * 초대 토큰 대조는 로그인 전에 일어나므로 세션이 없다.
   * 이 한 곳에서만 service_role을 쓰고, 조회 결과는 토큰 소지자에게 필요한
   * 최소 정보(프로젝트명·개발사명)로 제한한다.
   */
  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('project_invites')
    .select('id, email, role, expires_at, accepted_at, revoked_at, project_id, projects(name, code, agencies(name))')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle<InviteLookup>()

  if (!invite || invite.revoked_at) {
    return <InviteNotice title={ko.invite.invalidTitle} body={ko.invite.invalidBody} />
  }

  if (invite.accepted_at) {
    return (
      <InviteNotice title={ko.invite.usedTitle} body={ko.invite.usedBody}>
        <Button asChild variant="outline" className="w-full">
          <a href="/login">{ko.invite.goLogin}</a>
        </Button>
      </InviteNotice>
    )
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return (
      <InviteNotice title={ko.invite.expiredTitle} body={ko.invite.expiredBody}>
        <RequestNewLinkButton inviteId={invite.id} />
      </InviteNotice>
    )
  }

  return (
    <InviteAcceptForm
      token={token}
      email={invite.email}
      projectName={invite.projects?.name ?? ''}
      agencyName={invite.projects?.agencies?.name ?? ''}
    />
  )
}

function InviteNotice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  )
}
