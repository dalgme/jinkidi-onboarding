'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'
import { normalizeDomain, normalizeOrgSlug } from '@/lib/onboarding/slug'
import { touchClientActivity } from '@/lib/projects/queries'

const schema = z.object({
  projectCode: z.string().min(1),
  field: z.enum(['github_org', 'vercel_team_slug', 'supabase_org_slug', 'primary_domain']),
  value: z.string().trim().min(1).max(300),
})

const FIELD_KIND = {
  github_org: 'github',
  vercel_team_slug: 'vercel',
  supabase_org_slug: 'supabase',
} as const

export interface OrgSlugResult {
  ok: boolean
  message?: string
  value?: string
}

/**
 * 의뢰인이 만든 조직 이름을 저장한다.
 *
 * ⚠ 정규화가 실제 사용성을 좌우한다.
 *   «조직 이름만 입력하세요»라고 안내해도 의뢰인은 브라우저 주소창을 통째로
 *   복사해 붙여넣는다. URL 전체·@ 접두·공백·대문자를 모두 처리한다.
 *   알아볼 수 없으면 조용히 빈 값을 저장하지 않고 다시 입력을 요청한다 —
 *   빈 값이 저장되면 딥링크가 깨진 채로 의뢰인이 방치된다.
 */
export async function saveOrgSlug(input: unknown): Promise<OrgSlugResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: ko.portal.orgSlugInvalid }
  }
  const { projectCode, field, value } = parsed.data

  const { supabase, user, project, side } = await requireProjectAccess(projectCode)

  const normalized = field === 'primary_domain' ? normalizeDomain(value) : normalizeOrgSlug(value, FIELD_KIND[field])

  if (!normalized) {
    return { ok: false, message: ko.portal.orgSlugInvalid }
  }

  /*
   * projects는 의뢰인에게 읽기 전용이다 (RLS).
   * 의뢰인이 자기 조직 이름을 저장하는 것은 온보딩에 필요한 유일한 예외이므로
   * 서버에서 접근권을 확인한 뒤 service_role로 이 컬럼만 갱신한다.
   * 값은 위에서 정규화되어 형식이 보장된 상태다.
   */
  if (side === 'client') {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const { error } = await admin
      .from('projects')
      .update({ [field]: normalized })
      .eq('id', project.id)
    if (error) return { ok: false, message: error.message }
  } else {
    const { error } = await supabase
      .from('projects')
      .update({ [field]: normalized })
      .eq('id', project.id)
    if (error) return { ok: false, message: error.message }
  }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: side,
    action: 'project.org_slug_updated',
    meta: { field, value: normalized },
    clientVisible: false,
  })

  if (side === 'client') {
    await touchClientActivity(supabase, project.id)
  }

  revalidatePath(`/p/${projectCode}`)
  revalidatePath(`/app/projects/${projectCode}`)

  return { ok: true, value: normalized }
}
