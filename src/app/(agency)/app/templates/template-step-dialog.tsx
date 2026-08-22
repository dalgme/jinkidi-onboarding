'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ko } from '@/content/ko'
import type { OnboardingTemplateStep, OwnerSide, VerifyType } from '@/types/database'

import { saveTemplateStep } from './actions'

interface FormValues {
  key: string
  title: string
  descriptionMd: string
  ownerSide: OwnerSide
  verifyType: VerifyType
  estMinutes: string
  isRequired: boolean
}

const OWNER_OPTIONS: { value: OwnerSide; label: string }[] = [
  { value: 'client', label: ko.onboarding.stepOwnerClient },
  { value: 'agency', label: ko.onboarding.stepOwnerAgency },
  { value: 'both', label: ko.onboarding.stepOwnerBoth },
]

const VERIFY_OPTIONS: VerifyType[] = ['manual', 'github_member', 'vercel_member', 'supabase_member', 'dns']

export function TemplateStepDialog({
  templateId,
  step,
  open,
  onOpenChange,
}: {
  templateId: string
  step: OnboardingTemplateStep | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  const form = useForm<FormValues>({
    defaultValues: {
      key: step?.key ?? '',
      title: step?.title ?? '',
      descriptionMd: step?.description_md ?? '',
      ownerSide: step?.owner_side ?? 'client',
      verifyType: step?.verify_type ?? 'manual',
      estMinutes: step?.est_minutes ? String(step.est_minutes) : '',
      isRequired: step?.is_required ?? true,
    },
  })

  async function onSubmit(values: FormValues) {
    const result = await saveTemplateStep({
      templateId,
      stepId: step?.id,
      key: values.key,
      title: values.title,
      descriptionMd: values.descriptionMd,
      ownerSide: values.ownerSide,
      verifyType: values.verifyType,
      estMinutes: values.estMinutes === '' ? undefined : values.estMinutes,
      isRequired: values.isRequired,
    })

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.common.saved)
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{step ? ko.common.edit : ko.onboarding.addStep}</DialogTitle>
          <DialogDescription>{ko.agency.stepDescriptionHelp}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="step-key">{ko.agency.stepKeyLabel}</Label>
              <Input id="step-key" placeholder="github" {...form.register('key')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="step-est">{ko.agency.stepEstLabel}</Label>
              <Input id="step-est" type="number" min={0} {...form.register('estMinutes')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="step-title">{ko.agency.stepTitleLabel}</Label>
            <Input id="step-title" {...form.register('title')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="step-desc">{ko.agency.stepDescriptionLabel}</Label>
            <Textarea id="step-desc" className="min-h-[220px] font-mono text-sm" {...form.register('descriptionMd')} />
            <p className="text-xs text-muted-foreground">{ko.agency.stepDescriptionHelp}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="step-owner">{ko.agency.stepOwnerLabel}</Label>
              <Select value={form.watch('ownerSide')} onValueChange={(v) => form.setValue('ownerSide', v as OwnerSide)}>
                <SelectTrigger id="step-owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="step-verify">{ko.agency.stepVerifyLabel}</Label>
              <Select value={form.watch('verifyType')} onValueChange={(v) => form.setValue('verifyType', v as VerifyType)}>
                <SelectTrigger id="step-verify">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERIFY_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex min-h-touch cursor-pointer items-center gap-3">
            <Checkbox
              checked={form.watch('isRequired')}
              onCheckedChange={(c) => form.setValue('isRequired', c === true)}
              aria-label={ko.agency.stepRequiredLabel}
            />
            <span className="text-sm">{ko.agency.stepRequiredLabel}</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {ko.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? ko.common.saving : ko.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
