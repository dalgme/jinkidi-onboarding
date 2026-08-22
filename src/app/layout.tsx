import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'

import { ko } from '@/content/ko'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: ko.common.appName,
    template: `%s · ${ko.common.appName}`,
  },
  description: ko.common.appDescription,
  // 전 구간 비공개 내부 도구다 (설계 문서 5.4)
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 접근성 — 사용자가 확대할 수 있어야 한다
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard Variable — 한글 가독성 우선 (설계 문서 8.5) */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="font-sans">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
