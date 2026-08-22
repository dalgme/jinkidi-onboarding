'use client'

import { AlertCircle, Check, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ko } from '@/content/ko'
import { formatTime } from '@/lib/utils/format'

export type AutosaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'failed' }

/**
 * 저장 상태 표시.
 * 실패를 조용히 넘기면 의뢰인은 저장된 줄 알고 창을 닫는다 — 반드시 보이게 한다.
 */
export function AutosaveIndicator({ state, onRetry }: { state: AutosaveState; onRetry: () => void }) {
  if (state.kind === 'idle') return null

  if (state.kind === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {ko.intake.autosaveSaving}
      </span>
    )
  }

  if (state.kind === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5" aria-hidden />
        {ko.intake.autosaveSaved(formatTime(state.at))}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-destructive">
      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
      {ko.intake.autosaveFailed}
      <Button size="sm" variant="outline" className="h-7 min-h-0 px-2 text-xs" onClick={onRetry}>
        {ko.intake.autosaveRetry}
      </Button>
    </span>
  )
}
