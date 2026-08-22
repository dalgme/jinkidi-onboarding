'use client'

import { AlertTriangle, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ko } from '@/content/ko'

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-destructive" aria-hidden />
      <p className="text-base font-medium">{title ?? ko.common.genericErrorTitle}</p>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{message ?? ko.common.unknownError}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RotateCw aria-hidden />
          {ko.common.retry}
        </Button>
      ) : null}
    </div>
  )
}
