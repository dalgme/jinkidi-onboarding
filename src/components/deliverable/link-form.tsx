'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Link2 } from 'lucide-react'
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

import { createLinkDeliverable } from '@/app/(agency)/app/projects/[code]/deliverables/actions'

interface LinkValues {
  title: string
  url: string
  version: string
  description: string
}

export function LinkForm({ projectCode }: { projectCode: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const form = useForm<LinkValues>({ defaultValues: { title: '', url: '', version: '', description: '' } })

  async function onSubmit(values: LinkValues) {
    const result = await createLinkDeliverable({ projectCode, ...values })
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
          <Link2 aria-hidden />
          {ko.deliverable.addLink}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ko.deliverable.addLink}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="link-title">
              {ko.deliverable.titleLabel} <span className="text-destructive">*</span>
            </Label>
            <Input id="link-title" {...form.register('title', { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-url">
              {ko.deliverable.urlLabel} <span className="text-destructive">*</span>
            </Label>
            <Input id="link-url" type="url" placeholder="https://" {...form.register('url', { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-version">{ko.deliverable.versionLabel}</Label>
            <Input id="link-version" placeholder={ko.deliverable.versionPlaceholder} {...form.register('version')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link-description">{ko.deliverable.descriptionLabel}</Label>
            <Textarea id="link-description" {...form.register('description')} />
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
