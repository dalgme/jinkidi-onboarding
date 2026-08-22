import type { Metadata } from 'next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogoutButton } from '@/components/common/logout-button'
import { ko } from '@/content/ko'

export const metadata: Metadata = { title: ko.common.forbiddenTitle }

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{ko.common.forbiddenTitle}</CardTitle>
          <CardDescription>{ko.common.forbiddenBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton className="w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
