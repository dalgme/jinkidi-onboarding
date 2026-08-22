'use client'

import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/common/markdown'
import { ko } from '@/content/ko'
import { formatDateTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { Comment } from '@/types/database'

import { deleteComment } from './actions'

export function CommentList({
  comments,
  currentUserId,
  projectCode,
}: {
  comments: Comment[]
  currentUserId: string | null
  projectCode: string
}) {
  const router = useRouter()

  async function remove(commentId: string) {
    const result = await deleteComment(projectCode, commentId)
    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    router.refresh()
  }

  if (comments.length === 0) {
    return <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">{ko.comment.empty}</p>
  }

  return (
    <ul className="space-y-3">
      {comments.map((comment) => {
        const isAgency = comment.author_side === 'agency'
        const isMine = comment.author_user_id === currentUserId
        const isDeleted = comment.deleted_at !== null

        return (
          <li key={comment.id} className={cn('flex', isAgency ? 'justify-start' : 'justify-end')}>
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-4 py-3',
                isAgency ? 'bg-side-agency-bg text-side-agency-fg' : 'bg-side-client-bg text-side-client-fg',
              )}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Badge variant={isAgency ? 'agency' : 'client'}>
                  {isAgency ? ko.comment.sideAgency : ko.comment.sideClient}
                </Badge>
                <span className="text-xs opacity-70">{formatDateTime(comment.created_at)}</span>
                {isMine && !isDeleted ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 min-h-0 w-7 min-w-0"
                    onClick={() => void remove(comment.id)}
                    aria-label={ko.comment.delete}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>

              {isDeleted ? (
                <p className="text-sm italic opacity-60">{ko.comment.deleted}</p>
              ) : (
                <Markdown variant="comment">{comment.body_md}</Markdown>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
