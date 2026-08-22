import Link from 'next/link'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { ko } from '@/content/ko'

/** 공개 문서 레이아웃 — /terms, /privacy는 로그인 없이 열린다 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Alert variant="warning" className="mb-6">
          <AlertDescription>{ko.legal.draftNotice}</AlertDescription>
        </Alert>
        {children}
      </main>

      <footer className="border-t px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{ko.common.appName}</span>
          <nav className="flex gap-4">
            <Link href="/terms" className="underline underline-offset-4">
              {ko.nav.terms}
            </Link>
            <Link href="/privacy" className="underline underline-offset-4">
              {ko.nav.privacy}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
