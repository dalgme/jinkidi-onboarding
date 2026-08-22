'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ko } from '@/content/ko'
import { isNeedAdvice, type AnswerValue, type IntakeQuestion } from '@/lib/intake/schema'

/**
 * 문항 하나.
 *
 * 문구는 DB(intake_forms.schema)에서 온다 — 이것이 ko.ts 규칙의 유일한 예외다.
 * 모바일에서 라디오·체크박스 터치 영역을 충분히 크게 둔다 (44px 이상).
 */
export function QuestionField({
  question,
  value,
  onChange,
  disabled,
}: {
  question: IntakeQuestion
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
  disabled?: boolean
}) {
  const fieldId = `q-${question.key}`

  return (
    <fieldset className="space-y-3 border-b py-5 last:border-0" disabled={disabled}>
      <legend className="sr-only">{question.label}</legend>

      <div>
        <Label htmlFor={fieldId} className="text-base leading-relaxed">
          {question.label}
          {question.required ? <span className="ml-1 text-destructive">*</span> : null}
          {isNeedAdvice(value) ? (
            <Badge variant="progress" className="ml-2 align-middle">
              {ko.intake.needAdviceBadge}
            </Badge>
          ) : null}
        </Label>
        {question.help ? <p className="mt-1 text-sm text-muted-foreground">{question.help}</p> : null}
      </div>

      {question.type === 'single' && question.options ? (
        <RadioGroup
          value={typeof value === 'string' ? value : ''}
          onValueChange={onChange}
          aria-label={question.label}
          className="gap-1"
        >
          {question.options.map((option) => (
            <label
              key={option.value}
              className="flex min-h-touch cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent/50"
            >
              <RadioGroupItem value={option.value} id={`${fieldId}-${option.value}`} />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </RadioGroup>
      ) : null}

      {question.type === 'multi' && question.options ? (
        <div className="space-y-1" role="group" aria-label={question.label}>
          {question.options.map((option) => {
            const selected = Array.isArray(value) ? value : []
            return (
              <label
                key={option.value}
                className="flex min-h-touch cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-accent/50"
              >
                <Checkbox
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) => {
                    onChange(
                      checked === true
                        ? [...selected, option.value]
                        : selected.filter((v) => v !== option.value),
                    )
                  }}
                  aria-label={option.label}
                />
                <span className="text-sm">{option.label}</span>
              </label>
            )
          })}
        </div>
      ) : null}

      {question.type === 'text' ? (
        <Input id={fieldId} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
      ) : null}

      {question.type === 'longtext' ? (
        <Textarea
          id={fieldId}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[120px]"
        />
      ) : null}
    </fieldset>
  )
}
