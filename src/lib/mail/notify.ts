import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { ko } from '@/content/ko'
import type { Project, Side } from '@/types/database'

import {
  DeliverableSharedEmail,
  IntakeSubmittedEmail,
  NewCommentEmail,
  StepVerifiedEmail,
} from './templates'
import { agencyProjectUrl, optOutUrl, portalUrl, sendMail } from './send'

/**
 * 이벤트별 알림 발송 — 설계 문서 6.2
 *
 * 발송은 사용자 액션의 «트랜잭션 밖»에서 일어난다.
 * 메일이 실패해도 상태 변경 자체는 성공으로 남는다.
 */

interface Recipient {
  email: string
  userId: string | null
}

/** 프로젝트의 의뢰인 수신자. 알림을 끈 사람은 제외한다 */
async function clientRecipients(supabase: SupabaseClient, project: Project): Promise<Recipient[]> {
  const { data } = await supabase
    .from('client_members')
    .select('user_id, notification_opt_out')
    .eq('client_id', project.client_id)
    .returns<{ user_id: string; notification_opt_out: boolean }[]>()

  const active = (data ?? []).filter((m) => !m.notification_opt_out)
  return resolveEmails(supabase, active.map((m) => m.user_id))
}

/** 프로젝트를 맡은 개발사 수신자 */
async function agencyRecipients(supabase: SupabaseClient, project: Project): Promise<Recipient[]> {
  const { data } = await supabase
    .from('agency_members')
    .select('user_id, notification_opt_out')
    .eq('agency_id', project.agency_id)
    .returns<{ user_id: string; notification_opt_out: boolean }[]>()

  const active = (data ?? []).filter((m) => !m.notification_opt_out)
  return resolveEmails(supabase, active.map((m) => m.user_id))
}

/**
 * auth.users는 RLS 대상이 아니라 일반 클라이언트로 읽을 수 없다.
 * 이메일 조회는 service_role이 필요하므로 admin 클라이언트를 쓴다.
 */
async function resolveEmails(_supabase: SupabaseClient, userIds: readonly string[]): Promise<Recipient[]> {
  if (userIds.length === 0) return []

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const recipients: Recipient[] = []
  for (const userId of userIds) {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data.user?.email) continue
    recipients.push({ email: data.user.email, userId })
  }
  return recipients
}

export async function notifyStepVerified(supabase: SupabaseClient, project: Project, stepTitle: string): Promise<void> {
  const recipients = await clientRecipients(supabase, project)
  const url = portalUrl(project.code)

  await Promise.all(
    recipients.map((r) =>
      sendMail(supabase, {
        to: r.email,
        subject: ko.mail.stepVerifiedSubject(project.name, stepTitle),
        react: StepVerifiedEmail({ projectName: project.name, ctaUrl: url, optOutUrl: optOutUrl(), stepTitle }),
        type: 'step_verified',
        projectId: project.id,
        userId: r.userId,
        meta: { step_title: stepTitle },
      }),
    ),
  )
}

export async function notifyDeliverableShared(
  supabase: SupabaseClient,
  project: Project,
  deliverableTitle: string,
): Promise<void> {
  const recipients = await clientRecipients(supabase, project)
  const url = portalUrl(project.code, '/deliverables')

  await Promise.all(
    recipients.map((r) =>
      sendMail(supabase, {
        to: r.email,
        subject: ko.mail.deliverableSubject(project.name),
        react: DeliverableSharedEmail({
          projectName: project.name,
          ctaUrl: url,
          optOutUrl: optOutUrl(),
          deliverableTitle,
        }),
        type: 'deliverable_shared',
        projectId: project.id,
        userId: r.userId,
        meta: { deliverable_title: deliverableTitle },
      }),
    ),
  )
}

/** 새 코멘트는 «상대편»에게 간다 */
export async function notifyNewComment(
  supabase: SupabaseClient,
  project: Project,
  authorSide: Side,
  body: string,
  path: string,
): Promise<void> {
  const toClient = authorSide === 'agency'
  const recipients = toClient ? await clientRecipients(supabase, project) : await agencyRecipients(supabase, project)
  const url = toClient ? portalUrl(project.code, path) : agencyProjectUrl(project.code, path)
  const authorLabel = authorSide === 'agency' ? ko.comment.sideAgency : ko.comment.sideClient
  const excerpt = body.length > 200 ? `${body.slice(0, 200)}…` : body

  await Promise.all(
    recipients.map((r) =>
      sendMail(supabase, {
        to: r.email,
        subject: ko.mail.commentSubject(project.name),
        react: NewCommentEmail({
          projectName: project.name,
          ctaUrl: url,
          optOutUrl: optOutUrl(),
          authorLabel,
          excerpt,
        }),
        type: 'comment',
        projectId: project.id,
        userId: r.userId,
        meta: { author_side: authorSide },
      }),
    ),
  )
}

export async function notifyIntakeSubmitted(
  supabase: SupabaseClient,
  project: Project,
  clientName: string,
): Promise<void> {
  const recipients = await agencyRecipients(supabase, project)
  const url = agencyProjectUrl(project.code, '/intake')

  await Promise.all(
    recipients.map((r) =>
      sendMail(supabase, {
        to: r.email,
        subject: ko.mail.intakeSubmittedSubject(project.name),
        react: IntakeSubmittedEmail({ projectName: project.name, ctaUrl: url, optOutUrl: optOutUrl(), clientName }),
        type: 'intake_submitted',
        projectId: project.id,
        userId: r.userId,
        meta: {},
      }),
    ),
  )
}
