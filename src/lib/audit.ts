import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { requestMeta } from '@/lib/auth/guards'
import type { Json, Side } from '@/types/database'

/**
 * 감사 로그 — 설계 문서 7.4
 *
 * 「우리는 그 산출물 받은 적 없다」, 「초대한 적 없다」 같은 주장이 나올 때 유일한 근거다.
 * INSERT만 가능하고 UPDATE·DELETE는 RLS와 트리거로 차단되어 있다.
 */
export type AuditAction =
  | 'project.created'
  | 'project.updated'
  | 'project.org_slug_updated'
  | 'client.created'
  | 'client.updated'
  | 'step.status_changed'
  | 'step.created'
  | 'step.deleted'
  | 'step.verify_run'
  | 'steps.instantiated'
  | 'invite.sent'
  | 'invite.accepted'
  | 'invite.revoked'
  | 'member.added'
  | 'member.removed'
  | 'intake.saved'
  | 'intake.submitted'
  | 'intake.unlocked'
  | 'intake.note_saved'
  | 'deliverable.created'
  | 'deliverable.shared'
  | 'deliverable.approved'
  | 'deliverable.deleted'
  | 'comment.created'
  | 'comment.deleted'
  | 'cost.snapshot_saved'
  | 'consent.recorded'
  | 'template.updated'
  | 'rate.updated'

export interface AuditEntry {
  agencyId?: string | null
  projectId?: string | null
  actorUserId?: string | null
  actorSide?: Side | 'system' | null
  action: AuditAction
  meta?: Record<string, Json>
  /** 의뢰인 포털의 «최근 소식»에 노출할 항목인지 */
  clientVisible?: boolean
}

/**
 * 감사 로그를 남긴다.
 *
 * 기록 실패가 사용자 액션 전체를 실패시키지는 않지만, 조용히 삼키지도 않는다 —
 * 서버 로그에 남겨 운영 중에 발견할 수 있게 한다.
 */
export async function writeAudit(supabase: SupabaseClient, entry: AuditEntry): Promise<void> {
  const { ip, userAgent } = await requestMeta()

  const { error } = await supabase.from('audit_logs').insert({
    agency_id: entry.agencyId ?? null,
    project_id: entry.projectId ?? null,
    actor_user_id: entry.actorUserId ?? null,
    actor_side: entry.actorSide ?? null,
    action: entry.action,
    meta: entry.meta ?? {},
    ip,
    user_agent: userAgent,
    client_visible: entry.clientVisible ?? false,
  })

  if (error) {
    console.error('[audit] failed to write entry', { action: entry.action, error: error.message })
  }
}
