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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ko } from '@/content/ko'

import { createTemplate } from './actions'

export function NewTemplateDialog() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const form = useForm<{ name: string; description: string }>({ defaultValues: { name: '', description: '' } })

  async function onSubmit(values: { name: string; description: string }) {
    const result = await createTemplate(values)
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
          {ko.agency.templateNew}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ko.agency.templateNew}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="template-name">{ko.agency.stepTitleLabel}</Label>
            <Input id="template-name" {...form.register('name', { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template-desc">{ko.deliverable.descriptionLabel}</Label>
            <Textarea id="template-desc" {...form.register('description')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {ko.common.cancel}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {ko.common.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
