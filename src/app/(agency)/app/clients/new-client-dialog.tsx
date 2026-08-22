'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Textarea } from '@/components/ui/textarea'
import { ko } from '@/content/ko'

import { clientSchema, createClientRecord, type ClientInput } from './actions'

export function NewClientDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', businessNo: '', contactName: '', contactEmail: '', contactPhone: '', memo: '' },
  })

  async function onSubmit(values: ClientInput) {
    const result = await createClientRecord(values)
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
          {ko.agency.clientNew}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ko.agency.clientNew}</DialogTitle>
          <DialogDescription>{ko.agency.clientsTitle}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="client-name">
              {ko.agency.clientNameLabel} <span className="text-destructive">*</span>
            </Label>
            <Input id="client-name" {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="client-business-no">{ko.agency.clientBusinessNoLabel}</Label>
              <Input id="client-business-no" {...form.register('businessNo')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-contact-name">{ko.agency.clientContactNameLabel}</Label>
              <Input id="client-contact-name" {...form.register('contactName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-contact-email">{ko.agency.clientContactEmailLabel}</Label>
              <Input id="client-contact-email" type="email" {...form.register('contactEmail')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-contact-phone">{ko.agency.clientContactPhoneLabel}</Label>
              <Input id="client-contact-phone" type="tel" {...form.register('contactPhone')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-memo">{ko.agency.clientMemoLabel}</Label>
            <Textarea id="client-memo" {...form.register('memo')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {ko.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? ko.common.saving : ko.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
