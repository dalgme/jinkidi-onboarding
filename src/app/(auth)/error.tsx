'use client'

import { ErrorState } from '@/components/common/error-state'

export default function AuthError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState onRetry={reset} />
}
