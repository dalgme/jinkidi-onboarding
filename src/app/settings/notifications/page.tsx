import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ko } from '@/content/ko'
import { getUser } from '@/lib/auth/guards'

import { NotificationToggle } from './notification-toggle'

export const metadata: Metadata = { title: ko.mail.footerOptOut }

/**
 * 알림 끄기 — 모든 알림 메일의 푸터에서 링크된다.
 *
 * 법적 의무는 아니지만, 끌 수 없는 알림은 곧 필터링되어
 * 중요한 초대 메일까지 스팸함으로 간다 (설계 문서 6.2).
 * 초대 메일만은 opt-out 대상에서 제외한다.
 */
export default async function NotificationSettingsPage() {
  const { supabase, user } = await getUser()
  if (!user) redirect('/login')

  const [{ data: agencyMember }, { data: clientMember }] = await Promise.all([
    supabase
      .from('agency_members')
      .select('id, notification_opt_out')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string; notification_opt_out: boolean }>(),
    supabase
      .from('client_members')
      .select('id, notification_opt_out')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string; notification_opt_out: boolean }>(),
  ])

  const optedOut = agencyMember?.notification_opt_out ?? clientMember?.notification_opt_out ?? false
  const scope = agencyMember ? 'agency' : 'client'

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{ko.mail.footerOptOut}</CardTitle>
          <CardDescription>{ko.mail.footerNotice}</CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationToggle initialOptedOut={optedOut} scope={scope} />
        </CardContent>
      </Card>
    </div>
  )
}
