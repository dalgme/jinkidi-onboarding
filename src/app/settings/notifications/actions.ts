'use server'

import { z } from 'zod'

import { ko } from '@/content/ko'
import { getUser } from '@/lib/auth/guards'

const scopeSchema = z.enum(['agency', 'client'])

export interface ToggleResult {
  ok: boolean
  message?: string
}

export async function setNotificationOptOut(scope: string, optedOut: boolean): Promise<ToggleResult> {
  const parsed = scopeSchema.safeParse(scope)
  if (!parsed.success) return { ok: false, message: ko.common.unknownError }

  const { supabase, user } = await getUser()
  if (!user) return { ok: false, message: ko.common.forbiddenBody }

  // 본인 행만 갱신한다. RLS의 *_self_update 정책이 같은 조건을 다시 강제한다.
  const table = parsed.data === 'agency' ? 'agency_members' : 'client_members'
  const { error } = await supabase.from(table).update({ notification_opt_out: optedOut }).eq('user_id', user.id)

  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
