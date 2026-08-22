'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ko } from '@/content/ko'
import { calculateIntakeProgress, type AnswerValue, type IntakeAnswers, type IntakeFormSchema } from '@/lib/intake/schema'
import { saveIntakeAnswers, submitIntake } from '@/app/(portal)/p/[code]/intake/actions'

import { AutosaveIndicator, type AutosaveState } from './autosave-indicator'
import { QuestionField } from './question-field'

/** 값 변경 후 800ms 뒤에 저장한다 (설계 문서 2.3) */
const AUTOSAVE_DEBOUNCE_MS = 800

export function IntakeWizard({
  projectCode,
  form,
  initialAnswers,
  initialStageKey,
  agencyNotes,
  locked,
}: {
  projectCode: string
  form: IntakeFormSchema
  initialAnswers: IntakeAnswers
  initialStageKey: string | null
  agencyNotes: Record<string, string>
  locked: boolean
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<IntakeAnswers>(initialAnswers)
  const [saveState, setSaveState] = useState<AutosaveState>({ kind: 'idle' })
  const [submitting, setSubmitting] = useState(false)

  // 중간 이탈 후 재진입 시 마지막 위치로 돌아간다
  const startIndex = Math.max(
    0,
    form.stages.findIndex((s) => s.key === initialStageKey),
  )
  const [stageIndex, setStageIndex] = useState(startIndex)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<IntakeAnswers>(initialAnswers)

  const stage = form.stages[stageIndex]
  const progressPct = calculateIntakeProgress(form, answers)
  const isLastStage = stageIndex === form.stages.length - 1

  const persist = useCallback(
    async (next: IntakeAnswers, stageKey: string | undefined) => {
      setSaveState({ kind: 'saving' })
      const result = await saveIntakeAnswers({ projectCode, answers: next, lastStageKey: stageKey })

      if (!result.ok) {
        // 조용히 넘기지 않는다 — 32문항을 다시 채우게 할 수는 없다
        setSaveState({ kind: 'failed' })
        return
      }
      setSaveState({ kind: 'saved', at: result.savedAt ?? new Date().toISOString() })
    },
    [projectCode],
  )

  const scheduleSave = useCallback(
    (next: IntakeAnswers, stageKey: string | undefined) => {
      pending.current = next
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void persist(next, stageKey), AUTOSAVE_DEBOUNCE_MS)
    },
    [persist],
  )

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function update(questionKey: string, value: AnswerValue) {
    const next = { ...answers, [questionKey]: value }
    setAnswers(next)
    scheduleSave(next, stage?.key)
  }

  async function goToStage(index: number) {
    // 단계를 옮기기 전에 대기 중인 저장을 먼저 확정한다
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
      await persist(pending.current, form.stages[index]?.key)
    } else {
      await persist(answers, form.stages[index]?.key)
    }
    setStageIndex(index)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onSubmit() {
    setSubmitting(true)
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    await persist(answers, stage?.key)

    const result = await submitIntake(projectCode)
    setSubmitting(false)

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.intake.submitted)
    router.refresh()
  }

  if (!stage) return null

  return (
    <div className="space-y-5">
      {locked ? (
        <Alert variant="info">
          <AlertDescription>{ko.intake.submittedLocked}</AlertDescription>
        </Alert>
      ) : null}

      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium tabular-nums">
            {ko.intake.stageOf(stageIndex + 1, form.stages.length)}
          </span>
          <AutosaveIndicator state={saveState} onRetry={() => void persist(answers, stage.key)} />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={progressPct} label={ko.intake.title} />
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{progressPct}%</span>
        </div>
      </div>

      <Card>
        <CardContent className="py-5">
          <div className="mb-2">
            <h2 className="text-lg font-semibold">{stage.title}</h2>
            {stage.summary ? <p className="mt-1 text-sm text-muted-foreground">{stage.summary}</p> : null}
          </div>

          {stage.questions.map((question) => (
            <div key={question.key}>
              <QuestionField
                question={question}
                value={answers[question.key]}
                onChange={(value) => update(question.key, value)}
                disabled={locked}
              />
              {agencyNotes[question.key] ? (
                <Alert variant="info" className="mb-4">
                  <AlertDescription>
                    <span className="font-medium">{ko.intake.agencyNoteTitle}</span> · {agencyNotes[question.key]}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 pb-2">
        <Button
          variant="outline"
          size="lg"
          disabled={stageIndex === 0}
          onClick={() => void goToStage(stageIndex - 1)}
        >
          <ArrowLeft aria-hidden />
          {ko.common.prev}
        </Button>

        {isLastStage ? (
          <Button size="lg" disabled={submitting || locked} onClick={() => void onSubmit()}>
            {submitting ? ko.common.saving : ko.intake.submit}
          </Button>
        ) : (
          <Button size="lg" onClick={() => void goToStage(stageIndex + 1)}>
            {ko.common.next}
            <ArrowRight aria-hidden />
          </Button>
        )}
      </div>

      {isLastStage && !locked ? (
        <p className="text-center text-xs text-muted-foreground">{ko.intake.submitConfirm}</p>
      ) : null}
    </div>
  )
}
