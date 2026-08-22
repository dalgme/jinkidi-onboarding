import { CommentThread } from '@/components/comment/comment-thread'
import { IntakeWizard } from '@/components/intake/intake-wizard'
import { EmptyState } from '@/components/common/empty-state'
import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import { parseAnswers, parseIntakeForm } from '@/lib/intake/schema'
import type { IntakeForm, IntakeResponse } from '@/types/database'

import { ensureIntakeResponse } from './actions'

export default async function PortalIntakePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, project, side } = await requireProjectAccess(code)

  // 첫 진입 시 응답 레코드를 만든다
  await ensureIntakeResponse(code)

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

  if (!form) {
    return <EmptyState title={ko.intake.notStarted} />
  }

  const parsedForm = parseIntakeForm(form.schema)
  const notes = response.agency_notes as Record<string, string>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{parsedForm.title ?? ko.intake.title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{parsedForm.description ?? ko.intake.subtitle}</p>
      </div>

      <IntakeWizard
        projectCode={code}
        form={parsedForm}
        initialAnswers={parseAnswers(response.answers)}
        initialStageKey={response.last_stage_key}
        agencyNotes={notes ?? {}}
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
