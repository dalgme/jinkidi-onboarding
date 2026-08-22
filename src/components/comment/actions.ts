'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'
import { notifyNewComment } from '@/lib/mail/notify'
import { touchClientActivity } from '@/lib/projects/queries'

const createSchema = z.object({
  projectCode: z.string().min(1),
  subjectType: z.enum(['project', 'step', 'deliverable', 'intake']),
  subjectId: z.string().uuid().nullable(),
  body: z.string().trim().min(1).max(5000, ko.comment.tooLong),
})

export interface CommentResult {
  ok: boolean
  message?: string
}

const SUBJECT_PATH: Record<'project' | 'step' | 'deliverable' | 'intake', string> = {
  project: '',
  step: '',
  deliverable: '/deliverables',
  intake: '/intake',
}

/**
 * 코멘트 작성.
 *
 * ⚠ author_side는 요청 본문에서 받지 않는다.
 *   받으면 의뢰인이 개발사 명의로 코멘트를 달 수 있다.
 *   서버에서 side를 판정해 넣고, DB 트리거가 한 번 더 덮어쓴다 (이중 방어).
 */
export async function createComment(input: unknown): Promise<CommentResult> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? ko.common.unknownError }
  }
  const { projectCode, subjectType, subjectId, body } = parsed.data

  const { supabase, user, project, side } = await requireProjectAccess(projectCode)

  const { error } = await supabase.from('comments').insert({
    project_id: project.id,
    subject_type: subjectType,
    subject_id: subjectId,
    author_user_id: user.id,
    author_side: side,
    body_md: body,
  })

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: side,
    action: 'comment.created',
    meta: { subject_type: subjectType, subject_id: subjectId },
    clientVisible: side === 'agency',
  })

  if (side === 'client') {
    await touchClientActivity(supabase, project.id)
  }

  // 상대편에게 알린다. 메일 실패가 코멘트 작성을 되돌리지는 않는다.
  await notifyNewComment(supabase, project, side, body, SUBJECT_PATH[subjectType])

  revalidatePath(`/p/${projectCode}`, 'layout')
  revalidatePath(`/app/projects/${projectCode}`, 'layout')

  return { ok: true }
}

/** 자기 글만 soft delete. 원문은 남는다 — 분쟁 시 «그런 말 한 적 없다»를 방지 */
export async function deleteComment(projectCode: string, commentId: string): Promise<CommentResult> {
  const { supabase, user, project, side } = await requireProjectAccess(projectCode)

  const { error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('author_user_id', user.id)

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: side,
    action: 'comment.deleted',
    meta: { comment_id: commentId },
  })

  revalidatePath(`/p/${projectCode}`, 'layout')
  revalidatePath(`/app/projects/${projectCode}`, 'layout')

  return { ok: true }
}
