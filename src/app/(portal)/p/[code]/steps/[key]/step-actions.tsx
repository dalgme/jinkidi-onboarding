'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ko } from '@/content/ko'
import { changeStepStatus } from '@/lib/onboarding/step-actions'
import type { ProjectStep } from '@/types/database'

/**
 * 단계 하단 고정 액션 — 설계 문서 8.1
 *
 * 모바일에서 화면 하단 sticky로 둔다. 의뢰인은 스크롤을 끝까지 내리지 않는다.
 *
 * ⚠ 여기에 «확인 완료(verified)» 버튼은 없다.
 *   RLS가 막지만 UI에도 노출하지 않는다 — 있으면 눌러보고 실패하는 경험만 남는다.
 */
export function StepActions({ projectCode, step }: { projectCode: string; step: ProjectStep }) {
  const router = useRouter()
  const [blockOpen, setBlockOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)

  const alreadyDone = step.status === 'client_done' || step.status === 'verified'

  async function markDone() {
    setPending(true)
    const result = await changeStepStatus({ projectCode, stepId: step.id, status: 'client_done' })
    setPending(false)

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.common.saved)
    router.refresh()
  }

  async function markBlocked() {
    setPending(true)
    const result = await changeStepStatus({
      projectCode,
      stepId: step.id,
      status: 'blocked',
      blockedReason: reason,
    })
    setPending(false)

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.portal.blockedDone)
    setBlockOpen(false)
    setReason('')
    router.refresh()
  }

  return (
    <>
      {/* 하단 여백 확보 — sticky 바가 마지막 콘텐츠를 가리지 않게 */}
      <div className="h-4" aria-hidden />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-2xl gap-2 px-1 sm:px-0">
          <Button
            size="lg"
            className="flex-1"
            disabled={pending || step.status === 'verified'}
            onClick={() => void markDone()}
          >
            <Check aria-hidden />
            {alreadyDone ? ko.portal.markDoneAgain : ko.portal.markDone}
          </Button>
          <Button size="lg" variant="outline" disabled={pending} onClick={() => setBlockOpen(true)}>
            <HelpCircle aria-hidden />
            {ko.portal.markBlocked}
          </Button>
        </div>
      </div>

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ko.portal.blockedTitle}</DialogTitle>
            <DialogDescription>{ko.portal.blockedHelp}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="blocked-reason">{ko.onboarding.blockedReasonLabel}</Label>
            <Textarea
              id="blocked-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={ko.onboarding.blockedReasonPlaceholder}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockOpen(false)}>
              {ko.common.cancel}
            </Button>
            <Button disabled={pending || reason.trim() === ''} onClick={() => void markBlocked()}>
              {ko.portal.blockedSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
