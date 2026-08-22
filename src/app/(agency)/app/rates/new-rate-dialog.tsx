'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ko } from '@/content/ko'
import type { CostService } from '@/types/database'

import { createRate } from './actions'

interface RateValues {
  service: CostService
  plan: string
  itemKey: string
  label: string
  unit: string
  includedQty: string
  unitPriceUsd: string
  fixedPriceUsd: string
  effectiveFrom: string
}

const SERVICES: CostService[] = ['vercel', 'supabase', 'domain', 'resend']

export function NewRateDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const form = useForm<RateValues>({
    defaultValues: {
      service: 'vercel',
      plan: 'pro',
      itemKey: '',
      label: '',
      unit: 'GB',
      includedQty: '0',
      unitPriceUsd: '0',
      fixedPriceUsd: '0',
      effectiveFrom: new Date().toISOString().slice(0, 10),
    },
  })

  async function onSubmit(values: RateValues) {
    const result = await createRate(values)
    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.common.saved)
    form.reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden />
          {ko.common.add}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ko.agency.ratesTitle}</DialogTitle>
          <DialogDescription>{ko.agency.ratesHelp}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rate-service">{ko.cost.serviceLabel}</Label>
              <Select value={form.watch('service')} onValueChange={(v) => form.setValue('service', v as CostService)}>
                <SelectTrigger id="rate-service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-plan">{ko.agency.ratePlanLabel}</Label>
              <Input id="rate-plan" {...form.register('plan', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-item">{ko.agency.rateItemKeyLabel}</Label>
              <Input id="rate-item" placeholder="bandwidth_gb" {...form.register('itemKey', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-unit">{ko.agency.rateUnitLabel}</Label>
              <Input id="rate-unit" {...form.register('unit', { required: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate-label">{ko.deliverable.titleLabel}</Label>
            <Input id="rate-label" {...form.register('label', { required: true })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="rate-included">{ko.cost.includedLabel}</Label>
              <Input id="rate-included" type="number" step="0.001" {...form.register('includedQty')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-unit-price">{ko.agency.rateUnitPriceLabel}</Label>
              <Input id="rate-unit-price" type="number" step="0.0001" {...form.register('unitPriceUsd')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-fixed">{ko.agency.rateFixedPriceLabel}</Label>
              <Input id="rate-fixed" type="number" step="0.01" {...form.register('fixedPriceUsd')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate-effective">{ko.agency.rateEffectiveFromLabel}</Label>
            <Input id="rate-effective" type="date" {...form.register('effectiveFrom', { required: true })} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {ko.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {ko.common.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
