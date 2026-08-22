'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ClipboardCopy, Unlock } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ko } from '@/content/ko'
import { isNeedAdvice, type IntakeAnswers, type IntakeFormSchema, type IntakeQuestion } from '@/lib/intake/schema'

import { saveAgencyNote, unlockIntake } from '@/app/(portal)/p/[code]/intake/actions'

export function IntakeReview({
  projectCode,
  form,
  answers,
  notes,
  needAdviceKeys,
  markdown,
  locked,
}: {
  projectCode: string
  form: IntakeFormSchema
  answers: IntakeAnswers
  notes: Record<string, string>
  needAdviceKeys: string[]
  markdown: string
  locked: boolean
}) {
  const router = useRouter()
  const [onlyNeedAdvice, setOnlyNeedAdvice] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success(ko.common.copied)
    } catch {
      toast.error(ko.common.unknownError)
    }
  }

  async function unlock() {
    const result = await unlockIntake(projectCode)
    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.intake.unlocked)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={onlyNeedAdvice ? 'default' : 'outline'} size="sm" onClick={() => setOnlyNeedAdvice((v) => !v)}>
          {ko.intake.needAdviceFilter}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void copyMarkdown()}>
          {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
          {ko.intake.copyMarkdown}
        </Button>
        {locked ? (
          <Button variant="outline" size="sm" onClick={() => void unlock()}>
            <Unlock aria-hidden />
            {ko.intake.unlock}
          </Button>
        ) : null}
      </div>

      {form.stages.map((stage) => {
        const questions = onlyNeedAdvice
          ? stage.questions.filter((q) => needAdviceKeys.includes(q.key))
          : stage.questions

        if (questions.length === 0) return null

        return (
          <Card key={stage.key}>
            <CardContent className="py-5">
              <h3 className="mb-3 text-base font-semibold">{stage.title}</h3>
              <div className="space-y-5">
                {questions.map((question) => (
                  <QuestionReview
                    key={question.key}
                    projectCode={projectCode}
                    question={question}
                    answer={answers[question.key]}
                    note={notes[question.key] ?? ''}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function QuestionReview({
  projectCode,
  question,
  answer,
  note,
}: {
  projectCode: string
  question: IntakeQuestion
  answer: string | string[] | undefined
  note: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(note)
  const [saving, setSaving] = useState(false)

  const needsAdvice = isNeedAdvice(answer)

  async function save() {
    setSaving(true)
    const result = await saveAgencyNote({ projectCode, questionKey: question.key, note: value })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.common.saved)
    router.refresh()
  }

  return (
    <div className="border-b pb-5 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{question.label}</p>
        {needsAdvice ? <Badge variant="progress">{ko.intake.needAdviceBadge}</Badge> : null}
      </div>

      <div className="mt-1.5 text-sm">{renderAnswer(question, answer)}</div>

      {needsAdvice || note ? (
        <div className="mt-3 space-y-2">
          <Label htmlFor={`note-${question.key}`} className="text-xs text-muted-foreground">
            {ko.intake.agencyNoteLabel}
          </Label>
          <Textarea
            id={`note-${question.key}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={ko.intake.agencyNotePlaceholder}
            className="min-h-[72px]"
          />
          <Button size="sm" variant="outline" disabled={saving || value === note} onClick={() => void save()}>
            {saving ? ko.common.saving : ko.common.save}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function renderAnswer(question: IntakeQuestion, answer: string | string[] | undefined) {
  if (answer === undefined || (Array.isArray(answer) && answer.length === 0) || answer === '') {
    return <span className="text-muted-foreground">{ko.intake.noAnswer}</span>
  }

  if (question.options && question.options.length > 0) {
    const selected = Array.isArray(answer) ? answer : [answer]
    return (
      <ul className="list-inside list-disc space-y-0.5">
        {selected.map((v) => (
          <li key={v}>{question.options?.find((o) => o.value === v)?.label ?? v}</li>
        ))}
      </ul>
    )
  }

  return <p className="whitespace-pre-wrap">{Array.isArray(answer) ? answer.join(', ') : answer}</p>
}
