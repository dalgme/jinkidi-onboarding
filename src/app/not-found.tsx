import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ko } from '@/content/ko'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{ko.common.notFoundTitle}</CardTitle>
          <CardDescription>{ko.common.notFoundBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">{ko.nav.portalHome}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
