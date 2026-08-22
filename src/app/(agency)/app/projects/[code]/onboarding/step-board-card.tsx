'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { OwnerSideBadge, StepStatusBadge } from '@/components/common/status-badge'
import { ko } from '@/content/ko'
import { AGENCY_ALLOWED_STATUSES } from '@/lib/onboarding/transitions'
import { changeStepStatus } from '@/lib/onboarding/step-actions'
import { formatDateTime } from '@/lib/utils/format'
import type { ProjectStep, StepStatus } from '@/types/database'

import { VerifyButton } from './verify-button'

export function StepBoardCard({
  projectCode,
  step,
  commentCount,
  canVerify,
}: {
  projectCode: string
  step: ProjectStep
  commentCount: number
  canVerify: boolean
}) {
  const router = useRouter()
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [blockedReason, setBlockedReason] = useState(step.blocked_reason ?? '')
  const [pending, setPending] = useState(false)

  async function apply(status: StepStatus, reason?: string) {
    setPending(true)
    const result = await changeStepStatus({ projectCode, stepId: step.id, status, blockedReason: reason })
    setPending(false)

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.common.saved)
    setBlockDialogOpen(false)
    router.refresh()
  }

  function onStatusChange(next: string) {
    const status = next as StepStatus
    // blocked는 사유 없이 넘어갈 수 없다. 서버에서도 다시 막지만 여기서 먼저 물어본다.
    if (status === 'blocked') {
      setBlockDialogOpen(true)
      return
    }
    void apply(status)
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{step.order_index}</span>
              <h3 className="font-medium">{step.title}</h3>
              <OwnerSideBadge side={step.owner_side} />
              {!step.is_required ? <Badge variant="outline">{ko.common.optional}</Badge> : null}
              {step.est_minutes ? (
                <span className="text-xs text-muted-foreground">{ko.onboarding.estimate(step.est_minutes)}</span>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {step.client_done_at ? (
                <span>
                  {ko.onboarding.clientDoneAt} {formatDateTime(step.client_done_at)}
                </span>
              ) : null}
              {step.verified_at ? (
                <span>
                  {ko.onboarding.verifiedAt} {formatDateTime(step.verified_at)}
                </span>
              ) : null}
              {commentCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  {ko.onboarding.commentsCount(commentCount)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StepStatusBadge status={step.status} />
            <div className="w-36">
              <Select value={step.status} onValueChange={onStatusChange} disabled={pending}>
                <SelectTrigger aria-label={ko.onboarding.statusChange}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_ALLOWED_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ko.onboarding.status[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {step.status === 'blocked' && step.blocked_reason ? (
          <div className="rounded-md bg-status-blocked-bg px-3 py-2 text-sm text-status-blocked-fg">
            <span className="font-medium">{ko.onboarding.blockedReasonLabel}</span> · {step.blocked_reason}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
          {canVerify ? (
            <VerifyButton projectCode={projectCode} step={step} />
          ) : (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {ko.onboarding.verifyManual}
            </p>
          )}
        </div>
      </CardContent>

      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ko.onboarding.blockedReasonLabel}</DialogTitle>
            <DialogDescription>{ko.onboarding.blockedReasonRequired}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`blocked-${step.id}`}>{ko.onboarding.blockedReasonLabel}</Label>
            <Textarea
              id={`blocked-${step.id}`}
              value={blockedReason}
              onChange={(e) => setBlockedReason(e.target.value)}
              placeholder={ko.onboarding.blockedReasonPlaceholder}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              {ko.common.cancel}
            </Button>
            <Button disabled={pending || blockedReason.trim() === ''} onClick={() => void apply('blocked', blockedReason)}>
              {ko.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
