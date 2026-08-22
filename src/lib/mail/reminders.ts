import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { ko } from '@/content/ko'
import { findNextClientStep } from '@/lib/onboarding/progress'
import type { NotificationRecord, Project, ProjectStep } from '@/types/database'

import { ReminderEmail, StalledAgencyEmail } from './templates'
import { agencyProjectUrl, optOutUrl, portalUrl, sendMail } from './send'

/**
 * 정체 리마인더 — 설계 문서 6.2
 *
 * 온보딩이 실패하는 이유는 의뢰인이 거부해서가 아니라 «잊어버려서»다.
 *
 * ⚠ 14일에서 반드시 멈춘다. 무한 리마인더는 스팸이 되고,
 *   한 번 스팸으로 분류되면 이후의 중요한 메일까지 닿지 않는다.
 *   그 시점부터는 개발사에게 «직접 연락 필요»를 알린다.
 */
export const REMINDER_THRESHOLDS = [3, 7, 14] as const
export const STOP_AFTER_DAYS = 14

export interface ReminderRun {
  projectsChecked: number
  clientRemindersSent: number
  agencyAlertsSent: number
  skipped: number
}

interface ProjectWithSteps extends Project {
  project_steps: ProjectStep[]
}

/**
 * 마지막 활동으로부터 지난 일수에 «도달한» 임계값을 고른다.
 * 5일이면 3일 임계값, 10일이면 7일 임계값이 대상이다.
 */
export function thresholdFor(idleDays: number): number | null {
  const reached = REMINDER_THRESHOLDS.filter((t) => idleDays >= t)
  return reached.length > 0 ? (reached[reached.length - 1] ?? null) : null
}

export function idleDaysOf(project: Project, now: Date): number {
  const last = project.last_client_activity_at ?? project.started_at ?? project.created_at
  return Math.floor((now.getTime() - new Date(last).getTime()) / 86_400_000)
}

export async function runReminders(admin: SupabaseClient, now: Date = new Date()): Promise<ReminderRun> {
  const result: ReminderRun = { projectsChecked: 0, clientRemindersSent: 0, agencyAlertsSent: 0, skipped: 0 }

  // 대상: 온보딩 중이고 의뢰인 담당 미완료 단계가 남은 프로젝트
  const { data: projects } = await admin
    .from('projects')
    .select('*, project_steps(*)')
    .eq('status', 'onboarding')
    .is('deleted_at', null)
    .returns<ProjectWithSteps[]>()

  for (const project of projects ?? []) {
    result.projectsChecked += 1

    const nextStep = findNextClientStep(project.project_steps ?? [])
    if (!nextStep) {
      result.skipped += 1
      continue
    }

    const idleDays = idleDaysOf(project, now)
    const threshold = thresholdFor(idleDays)
    if (threshold === null) {
      result.skipped += 1
      continue
    }

    const overStop = idleDays > STOP_AFTER_DAYS
    const type = overStop ? 'stalled_agency' : 'reminder'

    // 같은 임계값으로 이미 보냈으면 재발송하지 않는다
    const { data: already } = await admin
      .from('notifications')
      .select('id')
      .eq('project_id', project.id)
      .eq('type', type)
      .eq('threshold_days', threshold)
      .limit(1)
      .returns<Pick<NotificationRecord, 'id'>[]>()

    if ((already ?? []).length > 0) {
      result.skipped += 1
      continue
    }

    if (overStop) {
      const recipients = await agencyEmails(admin, project.agency_id)
      for (const recipient of recipients) {
        await sendMail(admin, {
          to: recipient.email,
          subject: ko.mail.stalledAgencySubject(project.name),
          react: StalledAgencyEmail({
            projectName: project.name,
            ctaUrl: agencyProjectUrl(project.code),
            optOutUrl: optOutUrl(),
            daysIdle: idleDays,
          }),
          type: 'stalled_agency',
          projectId: project.id,
          userId: recipient.userId,
          thresholdDays: threshold,
          meta: { idle_days: idleDays },
        })
        result.agencyAlertsSent += 1
      }
      continue
    }

    const recipients = await clientEmails(admin, project.client_id)
    for (const recipient of recipients) {
      await sendMail(admin, {
        to: recipient.email,
        subject: ko.mail.reminderSubject(project.name),
        react: ReminderEmail({
          projectName: project.name,
          ctaUrl: portalUrl(project.code),
          optOutUrl: optOutUrl(),
          stepTitle: nextStep.title,
          daysIdle: idleDays,
        }),
        type: 'reminder',
        projectId: project.id,
        userId: recipient.userId,
        thresholdDays: threshold,
        meta: { idle_days: idleDays, step_key: nextStep.key },
      })
      result.clientRemindersSent += 1
    }
  }

  return result
}

interface Recipient {
  email: string
  userId: string
}

async function clientEmails(admin: SupabaseClient, clientId: string): Promise<Recipient[]> {
  const { data } = await admin
    .from('client_members')
    .select('user_id, notification_opt_out')
    .eq('client_id', clientId)
    .returns<{ user_id: string; notification_opt_out: boolean }[]>()

  return lookupEmails(
    admin,
    (data ?? []).filter((m) => !m.notification_opt_out).map((m) => m.user_id),
  )
}

async function agencyEmails(admin: SupabaseClient, agencyId: string): Promise<Recipient[]> {
  const { data } = await admin
    .from('agency_members')
    .select('user_id, notification_opt_out')
    .eq('agency_id', agencyId)
    .returns<{ user_id: string; notification_opt_out: boolean }[]>()

  return lookupEmails(
    admin,
    (data ?? []).filter((m) => !m.notification_opt_out).map((m) => m.user_id),
  )
}

async function lookupEmails(admin: SupabaseClient, userIds: readonly string[]): Promise<Recipient[]> {
  const recipients: Recipient[] = []
  for (const userId of userIds) {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data.user?.email) continue
    recipients.push({ email: data.user.email, userId })
  }
  return recipients
}
