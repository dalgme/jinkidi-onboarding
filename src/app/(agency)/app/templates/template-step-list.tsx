'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OwnerSideBadge } from '@/components/common/status-badge'
import { ko } from '@/content/ko'
import type { OnboardingTemplateStep } from '@/types/database'

import { deleteTemplateStep, moveTemplateStep } from './actions'
import { TemplateStepDialog } from './template-step-dialog'

export function TemplateStepList({ templateId, steps }: { templateId: string; steps: OnboardingTemplateStep[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<OnboardingTemplateStep | null>(null)
  const [creating, setCreating] = useState(false)

  async function move(stepId: string, direction: 'up' | 'down') {
    const result = await moveTemplateStep(templateId, stepId, direction)
    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    router.refresh()
  }

  async function remove(stepId: string) {
    const result = await deleteTemplateStep(stepId)
    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.common.saved)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">{step.order_index}</span>
                <span className="font-medium">{step.title}</span>
                <OwnerSideBadge side={step.owner_side} />
                <Badge variant="outline">{step.verify_type}</Badge>
                {!step.is_required ? <Badge variant="pending">{ko.common.optional}</Badge> : null}
                {step.est_minutes ? (
                  <span className="text-xs text-muted-foreground">{ko.onboarding.estimate(step.est_minutes)}</span>
                ) : null}
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{step.key}</p>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                disabled={index === 0}
                onClick={() => void move(step.id, 'up')}
                aria-label={ko.agency.moveUp}
              >
                <ChevronUp aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={index === steps.length - 1}
                onClick={() => void move(step.id, 'down')}
                aria-label={ko.agency.moveDown}
              >
                <ChevronDown aria-hidden />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditing(step)} aria-label={ko.common.edit}>
                <Pencil aria-hidden />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => void remove(step.id)} aria-label={ko.common.delete}>
                <Trash2 aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
        <Plus aria-hidden />
        {ko.onboarding.addStep}
      </Button>

      {creating ? (
        <TemplateStepDialog
          templateId={templateId}
          step={null}
          open
          onOpenChange={(open) => {
            if (!open) setCreating(false)
          }}
        />
      ) : null}

      {editing ? (
        <TemplateStepDialog
          templateId={templateId}
          step={editing}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}
