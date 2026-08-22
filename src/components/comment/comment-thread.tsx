import { createClient } from '@/lib/supabase/server'
import { ko } from '@/content/ko'
import type { Comment, CommentSubjectType, Side } from '@/types/database'

import { CommentForm } from './comment-form'
import { CommentList } from './comment-list'

/**
 * 다형 코멘트 스레드 — project / step / deliverable / intake 네 곳에 모두 붙는다.
 * Server Component로 데이터를 직접 읽는다 (useEffect + fetch 금지).
 */
export async function CommentThread({
  projectCode,
  projectId,
  subjectType,
  subjectId,
  currentSide,
}: {
  projectCode: string
  projectId: string
  subjectType: CommentSubjectType
  subjectId: string | null
  currentSide: Side
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let query = supabase
    .from('comments')
    .select('*')
    .eq('project_id', projectId)
    .eq('subject_type', subjectType)
    .order('created_at', { ascending: true })

  query = subjectId === null ? query.is('subject_id', null) : query.eq('subject_id', subjectId)

  const { data: comments } = await query.returns<Comment[]>()

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">{ko.comment.title}</h3>
      <CommentList comments={comments ?? []} currentUserId={user?.id ?? null} projectCode={projectCode} />
      <CommentForm
        projectCode={projectCode}
        subjectType={subjectType}
        subjectId={subjectId}
        currentSide={currentSide}
      />
    </section>
  )
}
