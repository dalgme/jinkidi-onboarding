import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  answersToMarkdown,
  calculateIntakeProgress,
  findNeedAdviceKeys,
  isNeedAdvice,
  NEED_ADVICE_VALUE,
  parseIntakeForm,
  type IntakeFormSchema,
} from '@/lib/intake/schema'

const seedForm = parseIntakeForm(
  JSON.parse(readFileSync(path.join(process.cwd(), 'supabase/seed/intake-form-v1.json'), 'utf-8')),
)

describe('시드 문답 스키마', () => {
  it('설계 문서 2.3대로 8단계 32문항이다', () => {
    expect(seedForm.stages).toHaveLength(8)
    expect(seedForm.stages.flatMap((s) => s.questions)).toHaveLength(32)
  })

  it('모든 객관식의 마지막 선택지는 「잘 모르겠어요 — 추천받을게요」다', () => {
    // 답을 강요하면 의뢰인은 폼을 닫는다. 이 선택지가 완주율을 지킨다.
    const choiceQuestions = seedForm.stages
      .flatMap((s) => s.questions)
      .filter((q) => q.type === 'single' || q.type === 'multi')

    expect(choiceQuestions.length).toBeGreaterThan(0)
    for (const question of choiceQuestions) {
      const last = question.options?.[question.options.length - 1]
      expect(last?.value, `${question.key}의 마지막 선택지`).toBe(NEED_ADVICE_VALUE)
    }
  })

  it('문항 키가 전역에서 고유하다 — answers는 평면 객체다', () => {
    const keys = seedForm.stages.flatMap((s) => s.questions).map((q) => q.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('단계별 문항 수가 설계 문서 표와 일치한다', () => {
    const counts = seedForm.stages.map((s) => s.questions.length)
    expect(counts).toEqual([4, 4, 5, 4, 4, 3, 3, 5])
  })
})

const form: IntakeFormSchema = {
  version: 'test',
  stages: [
    {
      key: 'a',
      title: 'A',
      questions: [
        { key: 'q1', type: 'single', label: 'Q1', required: true, options: [{ value: 'x', label: 'X' }] },
        { key: 'q2', type: 'text', label: 'Q2', required: true },
        { key: 'q3', type: 'text', label: 'Q3', required: false },
      ],
    },
  ],
}

describe('calculateIntakeProgress', () => {
  it('필수 문항만 분모에 넣는다', () => {
    expect(calculateIntakeProgress(form, { q1: 'x' })).toBe(50)
    expect(calculateIntakeProgress(form, { q1: 'x', q2: '답' })).toBe(100)
  })

  it('선택 문항만 채워도 진행률은 오르지 않는다', () => {
    expect(calculateIntakeProgress(form, { q3: '메모' })).toBe(0)
  })

  it('빈 문자열·빈 배열은 답변으로 치지 않는다', () => {
    expect(calculateIntakeProgress(form, { q1: '', q2: '   ' })).toBe(0)
    expect(calculateIntakeProgress(form, { q1: [] })).toBe(0)
  })
})

describe('추천 필요 판정', () => {
  it('단일 선택에서 need_advice를 잡아낸다', () => {
    expect(isNeedAdvice(NEED_ADVICE_VALUE)).toBe(true)
    expect(isNeedAdvice('x')).toBe(false)
  })

  it('복수 선택에 섞여 있어도 잡아낸다', () => {
    expect(isNeedAdvice(['a', NEED_ADVICE_VALUE])).toBe(true)
  })

  it('해당 문항 키를 모아준다', () => {
    expect(findNeedAdviceKeys(form, { q1: NEED_ADVICE_VALUE, q2: '답' })).toEqual(['q1'])
  })
})

describe('answersToMarkdown', () => {
  it('선택지는 value가 아니라 label로 옮긴다', () => {
    const md = answersToMarkdown(form, { q1: 'x', q2: '자유 응답' })
    expect(md).toContain('- X')
    expect(md).toContain('자유 응답')
  })

  it('개발사 제안을 인용문으로 함께 담는다', () => {
    const md = answersToMarkdown(form, { q1: NEED_ADVICE_VALUE }, { q1: '구독 모델을 권합니다' })
    expect(md).toContain('> **개발사 제안** — 구독 모델을 권합니다')
  })

  it('빈 답변은 「아직 답하지 않음」으로 표시한다', () => {
    expect(answersToMarkdown(form, {})).toContain('_아직 답하지 않음_')
  })
})
