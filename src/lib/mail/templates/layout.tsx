import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'

import { ko } from '@/content/ko'

export interface MailLayoutProps {
  projectName: string
  preview: string
  optOutUrl?: string
  children: ReactNode
}

/**
 * 모든 알림 메일의 공통 레이아웃.
 *
 * 푸터에 「알림 끄기」 링크를 반드시 넣는다 — 법적 의무는 아니지만,
 * 끌 수 없는 알림은 곧 필터링되어 중요한 초대 메일까지 스팸함으로 간다.
 */
export function MailLayout({ projectName, preview, optOutUrl, children }: MailLayoutProps) {
  return (
    <Html lang="ko">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.projectName}>{projectName}</Text>
          </Section>

          <Section>{children}</Section>

          <Hr style={styles.hr} />

          <Section>
            <Text style={styles.footer}>{ko.mail.footerNotice}</Text>
            <Text style={styles.footer}>{ko.mail.footerHelp}</Text>
            {optOutUrl ? (
              <Text style={styles.footer}>
                <Link href={optOutUrl} style={styles.footerLink}>
                  {ko.mail.footerOptOut}
                </Link>
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function MailButton({ href, label }: { href: string; label: string }) {
  return (
    <Section style={styles.buttonWrap}>
      <Link href={href} style={styles.button}>
        {label}
      </Link>
    </Section>
  )
}

export function MailParagraph({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>
}

/**
 * 메일 클라이언트는 <style> 태그와 클래스를 제대로 지원하지 않는다.
 * React Email의 인라인 스타일은 CLAUDE.md §6(웹 화면의 인라인 style 금지)의
 * 대상이 아니다 — 메일 HTML에는 Tailwind가 도달하지 않기 때문이다.
 */
const styles = {
  body: { backgroundColor: '#f6f7f9', fontFamily: 'Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif', margin: 0, padding: '24px 0' },
  container: { backgroundColor: '#ffffff', borderRadius: '12px', margin: '0 auto', maxWidth: '560px', padding: '32px' },
  header: { borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' },
  projectName: { color: '#111827', fontSize: '15px', fontWeight: 600, margin: 0 },
  paragraph: { color: '#1f2937', fontSize: '15px', lineHeight: '1.7', margin: '16px 0', wordBreak: 'keep-all' as const },
  buttonWrap: { margin: '28px 0' },
  button: {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    color: '#ffffff',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    padding: '14px 28px',
    textDecoration: 'none',
  },
  hr: { borderColor: '#e5e7eb', margin: '28px 0 16px' },
  footer: { color: '#6b7280', fontSize: '12px', lineHeight: '1.6', margin: '4px 0' },
  footerLink: { color: '#6b7280', textDecoration: 'underline' },
}
