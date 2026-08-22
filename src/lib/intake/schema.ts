import { z } from 'zod'

/**
 * 인테이크 문답 스키마 — 설계 문서 2.3
 *
 * 문항 문구는 ko.ts가 아니라 DB(intake_forms.schema)에서 온다.
 * 이것이 «컴포넌트에 한국어 문자열 금지» 규칙의 유일한 예외다 —
 * 개발사가 화면에서 문항을 고칠 수 있어야 하기 때문이다.
 */
export const questionTypeSchema = z.enum(['single', 'multi', 'text', 'longtext'])

export const optionSchema = z.object({
  value: z.string(),
  label: z.string(),
  help: z.string().optional(),
})

export const questionSchema = z.object({
  key: z.string(),
  type: questionTypeSchema,
  label: z.string(),
  help: z.string().optional(),
  options: z.array(optionSchema).optional(),
  required: z.boolean(),
})

export const stageSchema = z.object({
  key: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  questions: z.array(questionSchema),
})

export const intakeFormSchema = z.object({
  version: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  stages: z.array(stageSchema),
})

export type IntakeQuestion = z.infer<typeof questionSchema>
export type IntakeStage = z.infer<typeof stageSchema>
export type IntakeFormSchema = z.infer<typeof intakeFormSchema>
export type QuestionType = z.infer<typeof questionTypeSchema>

/** 「잘 모르겠어요 — 추천받을게요」 — 이 선택지가 폼의 완주율을 지킨다 */
export const NEED_ADVICE_VALUE = 'need_advice'

/** 답변 값. 객관식은 문자열 또는 문자열 배열 */
export type AnswerValue = string | string[]
export type IntakeAnswers = Record<string, AnswerValue>

export const answerValueSchema = z.union([z.string(), z.array(z.string())])
export const answersSchema = z.record(answerValueSchema)

/** DB에서 읽은 jsonb를 검증한다. 실패하면 화면을 그리지 않고 오류를 낸다 */
export function parseIntakeForm(raw: unknown): IntakeFormSchema {
  return intakeFormSchema.parse(raw)
}

export function parseAnswers(raw: unknown): IntakeAnswers {
  const result = answersSchema.safeParse(raw)
  return result.success ? result.data : {}
}

function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false
  if (Array.isArray(value)) return value.length > 0
  return value.trim().length > 0
}

/** 진행률 = 답변된 필수 문항 / 전체 필수 문항 */
export function calculateIntakeProgress(form: IntakeFormSchema, answers: IntakeAnswers): number {
  const required = form.stages.flatMap((s) => s.questions).filter((q) => q.required)
  if (required.length === 0) return 100

  const answered = required.filter((q) => isAnswered(answers[q.key])).length
  return Math.round((answered / required.length) * 100)
}

/** 「추천 필요」로 표시된 문항 키 */
export function findNeedAdviceKeys(form: IntakeFormSchema, answers: IntakeAnswers): string[] {
  const keys: string[] = []
  for (const stage of form.stages) {
    for (const question of stage.questions) {
      const value = answers[question.key]
      if (value === NEED_ADVICE_VALUE || (Array.isArray(value) && value.includes(NEED_ADVICE_VALUE))) {
        keys.push(question.key)
      }
    }
  }
  return keys
}

export function isNeedAdvice(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false
  return Array.isArray(value) ? value.includes(NEED_ADVICE_VALUE) : value === NEED_ADVICE_VALUE
}

/** 개발사가 회의·인계에 그대로 쓰도록 전체를 마크다운으로 만든다 */
export function answersToMarkdown(
  form: IntakeFormSchema,
  answers: IntakeAnswers,
  notes: Record<string, string> = {},
): string {
  const lines: string[] = [`# ${form.title ?? '기획 문답'}`, '']

  for (const stage of form.stages) {
    lines.push(`## ${stage.title}`, '')

    for (const question of stage.questions) {
      lines.push(`### ${question.label}`)

      const value = answers[question.key]
      if (!isAnswered(value)) {
        lines.push('', '_아직 답하지 않음_', '')
      } else if (question.options && question.options.length > 0) {
        const selected = Array.isArray(value) ? value : [value]
        const labels = selected.map((v) => question.options?.find((o) => o.value === v)?.label ?? v)
        lines.push('', labels.map((l) => `- ${l}`).join('\n'), '')
      } else {
        lines.push('', Array.isArray(value) ? value.join(', ') : (value ?? ''), '')
      }

      const note = notes[question.key]
      if (note && note.trim().length > 0) {
        lines.push(`> **개발사 제안** — ${note}`, '')
      }
    }
  }

  return lines.join('\n')
}
