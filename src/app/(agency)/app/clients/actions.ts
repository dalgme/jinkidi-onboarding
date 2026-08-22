'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ko } from '@/content/ko'
import { requireAgencyMember } from '@/lib/auth/guards'
import { writeAudit } from '@/lib/audit'

export const clientSchema = z.object({
  name: z.string().trim().min(1, ko.agency.clientNameLabel).max(120),
  businessNo: z.string().trim().max(30).optional(),
  contactName: z.string().trim().max(80).optional(),
  contactEmail: z.string().trim().email().optional().or(z.literal('')),
  contactPhone: z.string().trim().max(30).optional(),
  memo: z.string().trim().max(2000).optional(),
})

export type ClientInput = z.infer<typeof clientSchema>

export interface ActionResult {
  ok: boolean
  message?: string
}

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

export async function createClientRecord(input: unknown): Promise<ActionResult> {
  const parsed = clientSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? ko.common.unknownError }
  }

  const { supabase, user, member } = await requireAgencyMember()
  const values = parsed.data

  const { data, error } = await supabase
    .from('clients')
    .insert({
      // agency_id는 서버에서 결정한다. 클라이언트 값을 신뢰하지 않는다.
      agency_id: member.agency_id,
      name: values.name,
      business_no: blankToNull(values.businessNo),
      contact_name: blankToNull(values.contactName),
      contact_email: blankToNull(values.contactEmail),
      contact_phone: blankToNull(values.contactPhone),
      memo: blankToNull(values.memo),
    })
    .select('id')
    .single<{ id: string }>()

  if (error) {
    return { ok: false, message: error.message }
  }

  await writeAudit(supabase, {
    agencyId: member.agency_id,
    actorUserId: user.id,
    actorSide: 'agency',
    action: 'client.created',
    meta: { client_id: data.id, name: values.name },
  })

  revalidatePath('/app/clients')
  return { ok: true }
}
