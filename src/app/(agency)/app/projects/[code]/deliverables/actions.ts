'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'
import { notifyDeliverableShared } from '@/lib/mail/notify'
import { buildStoragePath, checkUpload, STORAGE_BUCKET } from '@/lib/deliverables/upload-policy'
import { touchClientActivity } from '@/lib/projects/queries'
import type { Deliverable } from '@/types/database'

export interface DeliverableResult {
  ok: boolean
  message?: string
}

const linkSchema = z.object({
  projectCode: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  url: z.string().trim().url(),
  description: z.string().trim().max(2000).optional(),
  version: z.string().trim().max(40).optional(),
})

export async function createLinkDeliverable(input: unknown): Promise<DeliverableResult> {
  const parsed = linkSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? ko.common.unknownError }
  }
  const values = parsed.data

  const { supabase, user, project, side } = await requireProjectAccess(values.projectCode)
  if (side !== 'agency') return { ok: false, message: ko.common.forbiddenBody }

  const { data, error } = await supabase
    .from('deliverables')
    .insert({
      project_id: project.id,
      kind: 'link',
      title: values.title,
      url: values.url,
      description: values.description || null,
      version: values.version || null,
      status: 'draft',
      created_by: user.id,
    })
    .select('id')
    .single<{ id: string }>()

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'deliverable.created',
    meta: { deliverable_id: data.id, kind: 'link', title: values.title },
  })

  revalidatePath(`/app/projects/${values.projectCode}/deliverables`)
  return { ok: true }
}

/**
 * 파일 업로드.
 *
 * 업로드는 서버에서 처리한다 — 버킷이 private이므로 클라이언트가 직접 올릴 수 없고,
 * MIME·확장자·크기 검사를 서버에서 다시 해야 신뢰할 수 있다.
 */
export async function uploadFileDeliverable(formData: FormData): Promise<DeliverableResult> {
  const projectCode = formData.get('projectCode')
  const title = formData.get('title')
  const version = formData.get('version')
  const description = formData.get('description')
  const file = formData.get('file')

  if (typeof projectCode !== 'string' || typeof title !== 'string' || !(file instanceof File)) {
    return { ok: false, message: ko.common.unknownError }
  }

  const { supabase, user, project, side } = await requireProjectAccess(projectCode)
  if (side !== 'agency') return { ok: false, message: ko.common.forbiddenBody }

  const rejection = checkUpload({ name: file.name, size: file.size, type: file.type })
  if (rejection === 'too_large') return { ok: false, message: ko.deliverable.fileTooLarge }
  if (rejection !== null) return { ok: false, message: ko.deliverable.fileTypeNotAllowed }

  // 경로에 넣을 id를 먼저 확보하기 위해 레코드를 만든 뒤 업로드한다
  const { data: created, error: insertError } = await supabase
    .from('deliverables')
    .insert({
      project_id: project.id,
      kind: 'file',
      title,
      description: typeof description === 'string' && description ? description : null,
      version: typeof version === 'string' && version ? version : null,
      // 경로는 업로드 성공 후 채운다. 임시로 placeholder를 넣는다.
      storage_path: `pending/${project.id}`,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      status: 'draft',
      created_by: user.id,
    })
    .select('id')
    .single<{ id: string }>()

  if (insertError) return { ok: false, message: insertError.message }

  const path = buildStoragePath(project.agency_id, project.id, created.id, file.name)

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadError) {
    // 업로드가 실패하면 껍데기 레코드를 남기지 않는다
    await supabase.from('deliverables').delete().eq('id', created.id)
    return { ok: false, message: uploadError.message }
  }

  const { error: updateError } = await supabase
    .from('deliverables')
    .update({ storage_path: path })
    .eq('id', created.id)

  if (updateError) return { ok: false, message: updateError.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'deliverable.created',
    meta: { deliverable_id: created.id, kind: 'file', title, file_name: file.name, size: file.size },
  })

  revalidatePath(`/app/projects/${projectCode}/deliverables`)
  return { ok: true }
}

export async function setDeliverableStatus(
  projectCode: string,
  deliverableId: string,
  status: 'draft' | 'shared',
): Promise<DeliverableResult> {
  const { supabase, user, project, side } = await requireProjectAccess(projectCode)
  if (side !== 'agency') return { ok: false, message: ko.common.forbiddenBody }

  const { data: deliverable } = await supabase
    .from('deliverables')
    .select('*')
    .eq('id', deliverableId)
    .eq('project_id', project.id)
    .maybeSingle<Deliverable>()

  if (!deliverable) return { ok: false, message: ko.common.notFoundBody }

  const { error } = await supabase
    .from('deliverables')
    .update({ status, shared_at: status === 'shared' ? new Date().toISOString() : null })
    .eq('id', deliverableId)

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'deliverable.shared',
    meta: { deliverable_id: deliverableId, deliverable_title: deliverable.title, status },
    clientVisible: status === 'shared',
  })

  if (status === 'shared') {
    await notifyDeliverableShared(supabase, project, deliverable.title)
  }

  revalidatePath(`/app/projects/${projectCode}/deliverables`)
  revalidatePath(`/p/${projectCode}/deliverables`)
  return { ok: true }
}

export async function deleteDeliverable(projectCode: string, deliverableId: string): Promise<DeliverableResult> {
  const { supabase, user, project, side } = await requireProjectAccess(projectCode)
  if (side !== 'agency') return { ok: false, message: ko.common.forbiddenBody }

  const { error } = await supabase
    .from('deliverables')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', deliverableId)
    .eq('project_id', project.id)

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'deliverable.deleted',
    meta: { deliverable_id: deliverableId },
  })

  revalidatePath(`/app/projects/${projectCode}/deliverables`)
  return { ok: true }
}

/** 의뢰인이 «확인했습니다»를 누른다. status를 approved로만 바꿀 수 있다 */
export async function approveDeliverable(projectCode: string, deliverableId: string): Promise<DeliverableResult> {
  const { supabase, user, project, side } = await requireProjectAccess(projectCode)

  const { error } = await supabase
    .from('deliverables')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: user.id })
    .eq('id', deliverableId)
    .eq('project_id', project.id)

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: side,
    action: 'deliverable.approved',
    meta: { deliverable_id: deliverableId },
  })

  if (side === 'client') {
    await touchClientActivity(supabase, project.id)
  }

  revalidatePath(`/p/${projectCode}/deliverables`)
  revalidatePath(`/app/projects/${projectCode}/deliverables`)
  return { ok: true }
}
