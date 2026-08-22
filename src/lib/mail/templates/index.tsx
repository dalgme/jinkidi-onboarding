import { Text } from '@react-email/components'

import { ko } from '@/content/ko'

import { MailButton, MailLayout, MailParagraph } from './layout'

export interface BaseMailProps {
  projectName: string
  ctaUrl: string
  optOutUrl?: string
}

/** 프로젝트 초대 — 제목이 성패를 가른다. 무엇을 얼마나 해야 하는지 제목에서 알 수 있게 */
export function InviteEmail({
  projectName,
  agencyName,
  ctaUrl,
}: BaseMailProps & { agencyName: string }) {
  return (
    <MailLayout projectName={projectName} preview={ko.mail.invitePreview}>
      <MailParagraph>안녕하세요. {agencyName}입니다.</MailParagraph>
      <MailParagraph>
        «{projectName}» 프로젝트를 시작하기 위해 대표님 명의로 계정 세 곳을 만들어주셔야 합니다. 전체 15분 정도 걸립니다.
      </MailParagraph>
      <Text style={{ color: '#1f2937', fontSize: '15px', lineHeight: '1.9', margin: '16px 0' }}>
        1. GitHub — 소스 코드가 보관될 곳
        <br />
        2. Vercel — 사이트가 실제로 올라갈 곳
        <br />
        3. Supabase — 데이터가 저장될 곳
      </Text>
      <MailParagraph>
        각 단계마다 무엇을 눌러야 하는지 화면에서 하나씩 안내해 드립니다. 지금 하지 않으셔도 되고, 중간에 멈추셨다가 이어서 하셔도 됩니다.
      </MailParagraph>
      <MailButton href={ctaUrl} label={ko.mail.inviteCta} />
      <Text style={{ color: '#6b7280', fontSize: '13px', lineHeight: '1.6' }}>
        이 링크는 14일간 유효합니다. 만료되면 담당자에게 알려주세요.
      </Text>
    </MailLayout>
  )
}

export function NewCommentEmail({
  projectName,
  ctaUrl,
  optOutUrl,
  authorLabel,
  excerpt,
}: BaseMailProps & { authorLabel: string; excerpt: string }) {
  return (
    <MailLayout projectName={projectName} preview={`${authorLabel}: ${excerpt}`} optOutUrl={optOutUrl}>
      <MailParagraph>{authorLabel}이(가) 새 코멘트를 남겼습니다.</MailParagraph>
      <Text
        style={{
          backgroundColor: '#f9fafb',
          borderLeft: '3px solid #d1d5db',
          color: '#374151',
          fontSize: '14px',
          lineHeight: '1.7',
          margin: '16px 0',
          padding: '12px 16px',
          whiteSpace: 'pre-wrap' as const,
        }}
      >
        {excerpt}
      </Text>
      <MailButton href={ctaUrl} label={ko.mail.commentCta} />
    </MailLayout>
  )
}

export function StepVerifiedEmail({
  projectName,
  ctaUrl,
  optOutUrl,
  stepTitle,
}: BaseMailProps & { stepTitle: string }) {
  return (
    <MailLayout projectName={projectName} preview={`${stepTitle} 확인 완료`} optOutUrl={optOutUrl}>
      <MailParagraph>«{stepTitle}» 단계가 확인되었습니다. 감사합니다.</MailParagraph>
      <MailParagraph>다음 단계가 준비되어 있다면 아래 버튼에서 이어서 진행하실 수 있습니다.</MailParagraph>
      <MailButton href={ctaUrl} label={ko.mail.stepVerifiedCta} />
    </MailLayout>
  )
}

export function DeliverableSharedEmail({
  projectName,
  ctaUrl,
  optOutUrl,
  deliverableTitle,
}: BaseMailProps & { deliverableTitle: string }) {
  return (
    <MailLayout projectName={projectName} preview={`새 산출물: ${deliverableTitle}`} optOutUrl={optOutUrl}>
      <MailParagraph>새 산출물 «{deliverableTitle}»이(가) 공유되었습니다.</MailParagraph>
      <MailParagraph>확인하신 뒤 의견이 있으시면 화면에서 코멘트로 남겨주세요.</MailParagraph>
      <MailButton href={ctaUrl} label={ko.mail.deliverableCta} />
    </MailLayout>
  )
}

/** 정체 리마인더 — 이 시스템의 실질적 핵심 기능 */
export function ReminderEmail({
  projectName,
  ctaUrl,
  optOutUrl,
  stepTitle,
  daysIdle,
}: BaseMailProps & { stepTitle: string; daysIdle: number }) {
  return (
    <MailLayout projectName={projectName} preview={`${stepTitle} 단계가 기다리고 있습니다`} optOutUrl={optOutUrl}>
      <MailParagraph>«{projectName}» 프로젝트가 {daysIdle}일째 다음 단계를 기다리고 있습니다.</MailParagraph>
      <MailParagraph>
        지금 하실 일은 «{stepTitle}» 하나입니다. 화면에서 무엇을 눌러야 하는지 순서대로 안내해 드립니다.
      </MailParagraph>
      <MailParagraph>혹시 막히신 부분이 있다면 화면의 «막혔어요» 버튼을 눌러주세요. 바로 도와드리겠습니다.</MailParagraph>
      <MailButton href={ctaUrl} label={ko.mail.reminderCta} />
    </MailLayout>
  )
}

export function IntakeSubmittedEmail({
  projectName,
  ctaUrl,
  optOutUrl,
  clientName,
}: BaseMailProps & { clientName: string }) {
  return (
    <MailLayout projectName={projectName} preview="기획 정보가 제출되었습니다" optOutUrl={optOutUrl}>
      <MailParagraph>{clientName}이(가) 기획 문답을 제출했습니다.</MailParagraph>
      <MailParagraph>«추천 필요»로 표시된 문항을 확인하고 제안을 채워주세요.</MailParagraph>
      <MailButton href={ctaUrl} label={ko.mail.intakeSubmittedCta} />
    </MailLayout>
  )
}

/** 14일 초과 — 의뢰인 발송을 멈추고 개발사에게 직접 연락을 요청한다 */
export function StalledAgencyEmail({
  projectName,
  ctaUrl,
  optOutUrl,
  daysIdle,
}: BaseMailProps & { daysIdle: number }) {
  return (
    <MailLayout projectName={projectName} preview="직접 연락이 필요합니다" optOutUrl={optOutUrl}>
      <MailParagraph>«{projectName}» 프로젝트가 {daysIdle}일째 진행되지 않고 있습니다.</MailParagraph>
      <MailParagraph>
        자동 리마인더는 여기서 멈춥니다. 더 보내면 스팸으로 분류되어 이후의 중요한 메일까지 닿지 않게 됩니다. 전화나 다른 경로로 직접 연락해주세요.
      </MailParagraph>
      <MailButton href={ctaUrl} label={ko.mail.stalledAgencyCta} />
    </MailLayout>
  )
}
