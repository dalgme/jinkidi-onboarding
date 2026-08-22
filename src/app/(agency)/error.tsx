'use client'

import { ErrorState } from '@/components/common/error-state'

export default function AgencyError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-2">
      <ErrorState onRetry={reset} />
    </div>
  )
}
