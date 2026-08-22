import { AlertTriangle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/common/empty-state'
import { ko } from '@/content/ko'
import { requireAgencyProject } from '@/lib/auth/guards'
import { calculateProgress, daysSince } from '@/lib/onboarding/progress'
import { formatDateTime } from '@/lib/utils/format'
import type { ProjectStep } from '@/types/database'

import { StepBoardCard } from './step-board-card'

export default async function OnboardingBoardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, project } = await requireAgencyProject(code)

  const [{ data: steps }, { data: owners }, { data: commentCounts }] = await Promise.all([
    supabase
      .from('project_steps')
      .select('*')
      .eq('project_id', project.id)
      .order('order_index', { ascending: true })
      .returns<ProjectStep[]>(),
    supabase
      .from('client_members')
      .select('id')
      .eq('client_id', project.client_id)
      .eq('role', 'owner')
      .returns<{ id: string }[]>(),
    supabase
      .from('comments')
      .select('subject_id')
      .eq('project_id', project.id)
      .eq('subject_type', 'step')
      .is('deleted_at', null)
      .returns<{ subject_id: string | null }[]>(),
  ])

  const rows = steps ?? []
  const progress = calculateProgress(rows)
  const idleDays = daysSince(project.last_client_activity_at)

  const countBySubject = new Map<string, number>()
  for (const c of commentCounts ?? []) {
    if (c.subject_id) countBySubject.set(c.subject_id, (countBySubject.get(c.subject_id) ?? 0) + 1)
  }

  // 의뢰인 측 owner가 1명뿐이면 그분이 자리를 비우는 순간 전부 잠긴다 (설계 문서 3.1)
  const soleOwner = (owners ?? []).length === 1

  return (
    <div className="space-y-5">
      {soleOwner ? (
        <Alert variant="warning">
          <AlertTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {ko.onboarding.soleOwnerWarningTitle}
          </AlertTitle>
          <AlertDescription>{ko.onboarding.soleOwnerWarningBody}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 py-4 sm:grid-cols-3">
          <Summary label={ko.onboarding.progress} value={`${progress.pct}%`} />
          <Summary label={ko.onboarding.progressOf(progress.verified, progress.total)} value="" />
          <Summary
            label={ko.onboarding.lastClientActivity}
            value={formatDateTime(project.last_client_activity_at)}
            hint={idleDays !== null && idleDays >= 7 ? ko.onboarding.stalledDays(idleDays) : undefined}
          />
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title={ko.onboarding.noStepsTitle} description={ko.onboarding.noStepsBody} />
      ) : (
        <ol className="space-y-3">
          {rows.map((step) => (
            <li key={step.id}>
              <StepBoardCard
                projectCode={code}
                step={step}
                commentCount={countBySubject.get(step.id) ?? 0}
                canVerify={step.verify_type !== 'manual'}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Summary({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {value ? <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p> : null}
      {hint ? <p className="mt-0.5 text-xs font-medium text-status-blocked-fg">{hint}</p> : null}
    </div>
  )
}
