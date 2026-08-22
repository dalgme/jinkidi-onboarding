import * as React from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * 진행률 바.
 *
 * CLAUDE.md §6이 인라인 style을 금지하므로, shadcn 기본형의
 * `style={{ transform: ... }}` 대신 5% 단위로 반올림한 유틸리티 클래스
 * (globals.css의 .progress-fill-N)를 쓴다. 시각적 차이는 없다.
 */
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100 */
  value: number
  label?: string
}

function quantize(value: number): number {
  const clamped = Math.min(100, Math.max(0, value))
  return Math.round(clamped / 5) * 5
}

export function Progress({ value, label, className, ...props }: ProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('relative h-2.5 w-full overflow-hidden rounded-full bg-secondary', className)}
      {...props}
    >
      <div
        className={cn('h-full rounded-full bg-primary transition-[width] duration-300', `progress-fill-${quantize(value)}`)}
      />
    </div>
  )
}
