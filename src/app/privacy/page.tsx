import type { Metadata } from 'next'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { Markdown } from '@/components/common/markdown'
import { ko } from '@/content/ko'

export const metadata: Metadata = {
  title: ko.legal.privacyTitle,
  robots: { index: true, follow: true },
}

export default async function PrivacyPage() {
  const [privacy, delegation] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/content/legal/privacy.md'), 'utf-8'),
    readFile(path.join(process.cwd(), 'src/content/legal/processing-delegation.md'), 'utf-8'),
  ])

  return (
    <>
      <Markdown>{privacy}</Markdown>
      {/* 초대 동의의 «처리 위탁» 항목이 이 앵커를 가리킨다 */}
      <section id="delegation" className="mt-12 border-t pt-8">
        <Markdown>{delegation}</Markdown>
      </section>
    </>
  )
}
