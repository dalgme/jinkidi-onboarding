import Link from 'next/link'
import { ArrowRight, Check, CircleDot, Circle, MinusCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import { findNextClientStep } from '@/lib/onboarding/progress'
import { formatRelative } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { AuditLog, ProjectStep, StepStatus } from '@/types/database'

/**
 * 포털 홈 — 설계 문서 5.2
 *
 * 이 화면 하나가 시스템의 성패를 결정한다.
 * 의뢰인이 링크를 클릭했을 때 3초 안에 «내가 지금 뭘 해야 하는지»를 알아야 한다.
 */
export default async function PortalHomePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, project } = await requireProjectAccess(code)

  const [{ data: steps }, { data: news }] = await Promise.all([
    supabase
      .from('project_steps')
      .select('*')
      .eq('project_id', project.id)
      .order('order_index', { ascending: true })
      .returns<ProjectStep[]>(),
    supabase
      .from('audit_logs')
      .select('*')
      .eq('project_id', project.id)
      .eq('client_visible', true)
      .order('created_at', { ascending: false })
      .limit(3)
      .returns<AuditLog[]>(),
  ])

  const list = steps ?? []
  // «지금 하실 일»은 항상 단 하나. 두 개 이상 보이면 의뢰인은 아무것도 시작하지 않는다.
  const next = findNextClientStep(list)

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-base font-semibold">{ko.portal.nowDoTitle}</h2>

        {next ? (
          <Card className="border-primary/30 bg-background shadow-sm">
            <CardContent className="space-y-4 py-5">
              <div>
                <h3 className="text-lg font-semibold leading-snug">{next.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {next.est_minutes ? ko.onboarding.estimate(next.est_minutes) : null}
                  {next.status === 'blocked' && next.blocked_reason ? ` · ${next.blocked_reason}` : null}
                </p>
              </div>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={`/p/${code}/steps/${next.key}`}>
                  {ko.portal.nowDoStart}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="font-medium">{ko.portal.allDoneTitle}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{ko.portal.allDoneBody}</p>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">{ko.portal.stepListTitle}</h2>
        <Card>
          <CardContent className="p-0">
            <ol>
              {list.map((step) => (
                <StepRow key={step.id} code={code} step={step} isNext={next?.id === step.id} />
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">{ko.portal.newsTitle}</h2>
        {(news ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{ko.portal.newsEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {(news ?? []).map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                <span className="text-sm">{describeNews(item)}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(item.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const STATUS_ICON: Record<StepStatus, typeof Check> = {
  verified: Check,
  client_done: Check,
  in_progress: CircleDot,
  blocked: CircleDot,
  pending: Circle,
  skipped: MinusCircle,
}

function StepRow({ code, step, isNext }: { code: string; step: ProjectStep; isNext: boolean }) {
  const Icon = STATUS_ICON[step.status]
  // 개발사 담당 단계는 회색으로 보이되 «지금 하실 일»에는 절대 오르지 않는다
  const isAgencyStep = step.owner_side === 'agency'

  const body = (
    <div className={cn('flex min-h-touch items-center gap-3 border-b px-4 py-3 last:border-0', isAgencyStep && 'opacity-60')}>
      <Icon
        className={cn(
          'h-5 w-5 shrink-0',
          step.status === 'verified' && 'text-status-verified-fg',
          step.status === 'client_done' && 'text-status-done-fg',
          step.status === 'blocked' && 'text-status-blocked-fg',
          step.status === 'in_progress' && 'text-status-progress-fg',
          (step.status === 'pending' || step.status === 'skipped') && 'text-muted-foreground',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', isNext && 'font-semibold')}>{step.title}</p>
        {isAgencyStep ? <p className="text-xs text-muted-foreground">{ko.portal.agencyStepNote}</p> : null}
      </div>
      <Badge
        variant={
          step.status === 'verified'
            ? 'verified'
            : step.status === 'client_done'
              ? 'done'
              : step.status === 'blocked'
                ? 'blocked'
                : step.status === 'in_progress'
                  ? 'progress'
                  : 'pending'
        }
      >
        {ko.onboarding.status[step.status]}
      </Badge>
    </div>
  )

  // 개발사 담당 단계는 눌러도 할 일이 없다. 링크로 만들지 않는다.
  if (isAgencyStep) {
    return <li>{body}</li>
  }

  return (
    <li>
      <Link href={`/p/${code}/steps/${step.key}`} className="block hover:bg-accent/50">
        {body}
      </Link>
    </li>
  )
}

/**
 * 감사 로그를 의뢰인이 읽을 수 있는 한 줄로 바꾼다.
 * 알아볼 수 없는 action은 아예 표시하지 않는 대신 무난한 문장으로 대체한다.
 */
function describeNews(log: AuditLog): string {
  const meta = log.meta as { step_key?: string; deliverable_title?: string; status?: string }

  switch (log.action) {
    case 'step.verify_run':
      return meta.status === 'verified' ? ko.portal.news.stepVerified : ko.portal.news.stepChecked
    case 'step.status_changed':
      return ko.portal.news.stepStatusChanged
    case 'deliverable.shared':
      return meta.deliverable_title
        ? ko.portal.news.deliverableShared(meta.deliverable_title)
        : ko.portal.news.deliverableSharedPlain
    case 'comment.created':
      return ko.portal.news.commentCreated
    default:
      return ko.portal.news.generic
  }
}
