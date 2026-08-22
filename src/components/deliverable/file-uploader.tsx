'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
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
import { ALLOWED_EXTENSIONS, checkUpload } from '@/lib/deliverables/upload-policy'

import { uploadFileDeliverable } from '@/app/(agency)/app/projects/[code]/deliverables/actions'

export function FileUploader({ projectCode }: { projectCode: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const file = formData.get('file')

    if (!(file instanceof File) || file.size === 0) {
      setError(ko.deliverable.fileLabel)
      return
    }

    // 서버에서 다시 검사하지만, 50MB를 올려보내고 거절당하는 경험은 피한다
    const rejection = checkUpload({ name: file.name, size: file.size, type: file.type })
    if (rejection === 'too_large') {
      setError(ko.deliverable.fileTooLarge)
      return
    }
    if (rejection !== null) {
      setError(ko.deliverable.fileTypeNotAllowed)
      return
    }

    formData.set('projectCode', projectCode)

    setPending(true)
    const result = await uploadFileDeliverable(formData)
    setPending(false)

    if (!result.ok) {
      setError(result.message ?? ko.common.unknownError)
      return
    }

    toast.success(ko.common.saved)
    formRef.current?.reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload aria-hidden />
          {ko.deliverable.addFile}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ko.deliverable.addFile}</DialogTitle>
          <DialogDescription>{ko.deliverable.fileHelp}</DialogDescription>
        </DialogHeader>

        <form ref={formRef} className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="file-title">
              {ko.deliverable.titleLabel} <span className="text-destructive">*</span>
            </Label>
            <Input id="file-title" name="title" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-input">
              {ko.deliverable.fileLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="file-input"
              name="file"
              type="file"
              required
              accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-version">{ko.deliverable.versionLabel}</Label>
            <Input id="file-version" name="version" placeholder={ko.deliverable.versionPlaceholder} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-description">{ko.deliverable.descriptionLabel}</Label>
            <Textarea id="file-description" name="description" />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {ko.common.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? ko.common.saving : ko.common.add}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
