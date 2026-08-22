import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/common/markdown'
import { ko } from '@/content/ko'
import { formatDateTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { Comment } from '@/types/database'

import { DeleteCommentButton } from './delete-comment-button'

/**
 * 코멘트 목록 — Server Component.
 *
 * 마크다운 렌더링(react-markdown + rehype-sanitize)은 클라이언트 번들에서
 * 50KB 가까이 차지한다. 렌더 결과는 정적이므로 서버에서 그리고,
 * 인터랙션이 필요한 삭제 버튼만 클라이언트 컴포넌트로 남긴다.
 */
export function CommentList({
  comments,
  currentUserId,
  projectCode,
}: {
  comments: Comment[]
  currentUserId: string | null
  projectCode: string
}) {
  if (comments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
        {ko.comment.empty}
      </p>
    )
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
                  <DeleteCommentButton projectCode={projectCode} commentId={comment.id} />
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
