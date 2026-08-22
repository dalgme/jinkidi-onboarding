import type { Metadata } from 'next'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { Markdown } from '@/components/common/markdown'
import { ko } from '@/content/ko'

export const metadata: Metadata = {
  title: ko.legal.termsTitle,
  // 약관·처리방침은 색인 예외 (설계 문서 5.4)
  robots: { index: true, follow: true },
}

export default async function TermsPage() {
  const source = await readFile(path.join(process.cwd(), 'src/content/legal/terms.md'), 'utf-8')
  return <Markdown>{source}</Markdown>
}
