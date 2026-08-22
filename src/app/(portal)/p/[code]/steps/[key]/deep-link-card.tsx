'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ko } from '@/content/ko'
import type { DeepLinkSpec } from '@/lib/onboarding/deep-links'

/**
 * 딥링크 카드 — 설계 문서 5.3
 *
 * 의뢰인을 설명 페이지가 아니라 «바로 그 초대 화면»으로 보낸다.
 * 이메일은 반드시 복사 버튼으로 준다 — 직접 타이핑하다 나는 오타가
 * 초대 실패의 가장 큰 원인이다.
 */
export function DeepLinkCard({
  spec,
  slug,
  agencyEmail,
}: {
  spec: DeepLinkSpec
  slug: string
  agencyEmail: string
}) {
  const [copied, setCopied] = useState(false)

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(agencyEmail)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드 권한이 없으면 아래 텍스트를 직접 선택해 복사하면 된다
    }
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-4 py-5">
        <Button asChild size="lg" className="w-full">
          {/* 새 탭으로 연다 — 포털을 떠나지 않게 */}
          <a href={spec.buildUrl(slug)} target="_blank" rel="noopener noreferrer">
            {ko.portal.deepLinkTitle}
            <ExternalLink aria-hidden />
          </a>
        </Button>
        <p className="text-center text-xs text-muted-foreground">{ko.portal.deepLinkHelp}</p>

        {agencyEmail ? (
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium">{ko.portal.copyInviteEmail}</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-background px-3 py-2 text-sm">{agencyEmail}</code>
              <Button size="icon" variant="outline" onClick={() => void copyEmail()} aria-label={ko.portal.copyInviteEmail}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{ko.portal.inviteEmailHelp}</p>
          </div>
        ) : null}

        <div className="rounded-lg border border-dashed p-4">
          <p className="text-sm">
            <span className="text-muted-foreground">{ko.portal.roleGuide}</span>{' '}
            <span className="font-semibold">{spec.role}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
