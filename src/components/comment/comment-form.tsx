'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ko } from '@/content/ko'
import type { CommentSubjectType, Side } from '@/types/database'

import { createComment } from './actions'

export function CommentForm({
  projectCode,
  subjectType,
  subjectId,
}: {
  projectCode: string
  subjectType: CommentSubjectType
  subjectId: string | null
  currentSide: Side
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    // author_side는 보내지 않는다. 서버가 판정한다.
    const result = await createComment({ projectCode, subjectType, subjectId, body })
    setPending(false)

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    setBody('')
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={ko.comment.placeholder}
        aria-label={ko.comment.title}
        className="min-h-[88px]"
      />
      <div className="flex justify-end">
        <Button disabled={pending || body.trim() === ''} onClick={() => void submit()}>
          {pending ? ko.common.saving : ko.comment.submit}
        </Button>
      </div>
    </div>
  )
}
