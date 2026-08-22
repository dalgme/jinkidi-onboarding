import { Badge } from '@/components/ui/badge'
import { ko } from '@/content/ko'
import type { OwnerSide, StepStatus } from '@/types/database'

const STATUS_VARIANT: Record<StepStatus, 'pending' | 'progress' | 'done' | 'verified' | 'blocked' | 'skipped'> = {
  pending: 'pending',
  in_progress: 'progress',
  client_done: 'done',
  verified: 'verified',
  blocked: 'blocked',
  skipped: 'skipped',
}

export function StepStatusBadge({ status }: { status: StepStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{ko.onboarding.status[status]}</Badge>
}

const OWNER_LABEL: Record<OwnerSide, string> = {
  client: ko.onboarding.stepOwnerClient,
  agency: ko.onboarding.stepOwnerAgency,
  both: ko.onboarding.stepOwnerBoth,
}

export function OwnerSideBadge({ side }: { side: OwnerSide }) {
  return <Badge variant={side === 'agency' ? 'agency' : 'client'}>{OWNER_LABEL[side]}</Badge>
}
