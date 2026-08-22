import Link from 'next/link'

import { ko } from '@/content/ko'

/** (auth) — 헤더 없는 중앙 정렬 카드 레이아웃 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <p className="text-lg font-semibold tracking-tight">{ko.common.appName}</p>
            <p className="mt-1 text-sm text-muted-foreground">{ko.common.appDescription}</p>
          </div>
          {children}
        </div>
      </main>
      <footer className="px-4 pb-8 text-center text-xs text-muted-foreground">
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
