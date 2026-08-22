import Link from 'next/link'

import { ko } from '@/content/ko'

/**
 * (portal) — 의뢰인 영역.
 *
 * 모바일 우선. 여백 넓게, 글씨 크게, 사이드바 없음.
 * 의뢰인은 이메일을 휴대폰으로 열고 그 자리에서 링크를 누른다.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/20">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pb-10 sm:pt-8">{children}</main>

      <footer className="mx-auto w-full max-w-2xl px-4 pb-8 text-center text-xs text-muted-foreground sm:px-6">
        <Link href="/terms" className="underline underline-offset-4">
          {ko.nav.terms}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="underline underline-offset-4">
          {ko.nav.privacy}
        </Link>
      </footer>
    </div>
  )
}
