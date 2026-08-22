import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CommentThread } from '@/components/comment/comment-thread'
import { EmptyState } from '@/components/common/empty-state'
import { ko } from '@/content/ko'
import { requireAgencyProject } from '@/lib/auth/guards'
import { answersToMarkdown, findNeedAdviceKeys, parseAnswers, parseIntakeForm } from '@/lib/intake/schema'
import { formatDateTime } from '@/lib/utils/format'
import type { IntakeForm, IntakeResponse } from '@/types/database'

import { IntakeReview } from './intake-review'

export default async function AgencyIntakePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, project, side } = await requireAgencyProject(code)

  const { data: response } = await supabase
    .from('intake_responses')
    .select('*')
    .eq('project_id', project.id)
    .maybeSingle<IntakeResponse>()

  if (!response) {
    return <EmptyState title={ko.intake.notStarted} />
  }

  const { data: form } = await supabase
    .from('intake_forms')
    .select('*')
    .eq('id', response.form_id)
    .maybeSingle<IntakeForm>()

  if (!form) return <EmptyState title={ko.intake.notStarted} />

  const parsedForm = parseIntakeForm(form.schema)
  const answers = parseAnswers(response.answers)
  const notes = (response.agency_notes as Record<string, string>) ?? {}
  const needAdvice = findNeedAdviceKeys(parsedForm, answers)
  const markdown = answersToMarkdown(parsedForm, answers, notes)

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{ko.intake.progressLabel(response.progress_pct)}</p>
            <div className="mt-1.5 flex items-center gap-3">
              <Progress value={response.progress_pct} className="max-w-xs" label={ko.intake.title} />
              <span className="text-sm tabular-nums">{response.progress_pct}%</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {needAdvice.length > 0 ? (
              <Badge variant="progress">
                {ko.intake.needAdviceBadge} {needAdvice.length}
              </Badge>
            ) : null}
            {response.submitted_at ? (
              <Badge variant="verified">{formatDateTime(response.submitted_at)} 제출</Badge>
            ) : (
              <Badge variant="pending">{ko.agency.invitePending}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <IntakeReview
        projectCode={code}
        form={parsedForm}
        answers={answers}
        notes={notes}
        needAdviceKeys={needAdvice}
        markdown={markdown}
        locked={response.submitted_at !== null && response.unlocked_at === null}
      />

      <CommentThread
        projectCode={code}
        projectId={project.id}
        subjectType="intake"
        subjectId={null}
        currentSide={side}
      />
    </div>
  )
}
