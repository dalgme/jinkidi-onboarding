'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ko } from '@/content/ko'

import { deleteComment } from './actions'

export function DeleteCommentButton({ projectCode, commentId }: { projectCode: string; commentId: string }) {
  const router = useRouter()

  async function remove() {
    const result = await deleteComment(projectCode, commentId)
    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    router.refresh()
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 min-h-0 w-7 min-w-0"
      onClick={() => void remove()}
      aria-label={ko.comment.delete}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
    </Button>
  )
}
