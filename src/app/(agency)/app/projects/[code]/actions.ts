'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireAgencyProject } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'
import { generateInviteToken, inviteExpiryDate } from '@/lib/auth/invite-token'
import { normalizeDomain, normalizeOrgSlug } from '@/lib/onboarding/slug'
import { inviteUrl, sendMail } from '@/lib/mail/send'
import { InviteEmail } from '@/lib/mail/templates'

export interface ProjectActionResult {
  ok: boolean
  message?: string
  value?: string | null
}

const orgFieldSchema = z.object({
  projectCode: z.string().min(1),
  field: z.enum(['github_org', 'vercel_team_slug', 'supabase_org_slug', 'primary_domain']),
  value: z.string().trim().max(300),
})

const FIELD_KIND = {
  github_org: 'github',
  vercel_team_slug: 'vercel',
  supabase_org_slug: 'supabase',
} as const

/**
 * 조직 slug·도메인 저장.
 *
 * 입력값은 반드시 정규화한다 — 의뢰인도 개발사도 주소창을 통째로 붙여넣는다.
 * 알아볼 수 없으면 «조용히 빈 값 저장» 대신 오류를 돌려준다.
 */
export async function updateOrgField(input: unknown): Promise<ProjectActionResult> {
  const parsed = orgFieldSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: ko.common.unknownError }
  }
  const { projectCode, field, value } = parsed.data

  const { supabase, user, project } = await requireAgencyProject(projectCode)

  let normalized: string | null
  if (value.trim() === '') {
    normalized = null
  } else if (field === 'primary_domain') {
    normalized = normalizeDomain(value)
    if (!normalized) return { ok: false, message: ko.portal.orgSlugInvalid }
  } else {
    normalized = normalizeOrgSlug(value, FIELD_KIND[field])
    if (!normalized) return { ok: false, message: ko.portal.orgSlugInvalid }
  }

  const { error } = await supabase
    .from('projects')
    .update({ [field]: normalized })
    .eq('id', project.id)

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'project.org_slug_updated',
    meta: { field, value: normalized },
  })

  revalidatePath(`/app/projects/${projectCode}`)
  revalidatePath(`/p/${projectCode}`)
  return { ok: true, value: normalized }
}

const inviteSchema = z.object({
  projectCode: z.string().min(1),
  email: z.string().trim().email(),
  role: z.enum(['owner', 'member']),
})

/** 의뢰인 초대 — 설계 문서 3.3 */
export async function sendProjectInvite(input: unknown): Promise<ProjectActionResult> {
  const parsed = inviteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: ko.auth.invalidEmail }
  }
  const { projectCode, email, role } = parsed.data

  const { supabase, user, project } = await requireAgencyProject(projectCode)

  const { data: agency } = await supabase
    .from('agencies')
    .select('name')
    .eq('id', project.agency_id)
    .maybeSingle<{ name: string }>()

  // 토큰 원문은 메일에만 실린다. DB에는 해시만 남는다.
  const { token, tokenHash } = generateInviteToken()

  const { error } = await supabase.from('project_invites').insert({
    project_id: project.id,
    email: email.toLowerCase(),
    role,
    token_hash: tokenHash,
    expires_at: inviteExpiryDate().toISOString(),
    invited_by: user.id,
  })

  if (error) return { ok: false, message: error.message }

  const result = await sendMail(supabase, {
    to: email,
    subject: ko.mail.inviteSubject(project.name),
    react: InviteEmail({
      projectName: project.name,
      agencyName: agency?.name ?? '',
      ctaUrl: inviteUrl(token),
    }),
    type: 'invite',
    projectId: project.id,
    meta: { role },
  })

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'invite.sent',
    meta: { email, role, mail_ok: result.ok },
  })

  revalidatePath(`/app/projects/${projectCode}`)

  if (!result.ok) {
    return { ok: false, message: `${ko.auth.sendFailed} (${result.error ?? ''})` }
  }
  return { ok: true, message: ko.agency.inviteSent }
}

export async function revokeInvite(projectCode: string, inviteId: string): Promise<ProjectActionResult> {
  const { supabase, user, project } = await requireAgencyProject(projectCode)

  const { error } = await supabase
    .from('project_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('project_id', project.id)

  if (error) return { ok: false, message: error.message }

  await writeAudit(supabase, {
    agencyId: project.agency_id,
    projectId: project.id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'invite.revoked',
    meta: { invite_id: inviteId },
  })

  revalidatePath(`/app/projects/${projectCode}`)
  return { ok: true }
}
