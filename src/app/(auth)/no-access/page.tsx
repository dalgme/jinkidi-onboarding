import type { Metadata } from 'next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ko } from '@/content/ko'

import { LogoutButton } from '@/components/common/logout-button'

export const metadata: Metadata = { title: ko.auth.noAccessTitle }

export default function NoAccessPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{ko.auth.noAccessTitle}</CardTitle>
        <CardDescription>{ko.auth.noAccessBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <LogoutButton className="w-full" />
      </CardContent>
    </Card>
  )
}
