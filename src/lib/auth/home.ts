import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 로그인 후 어디로 보낼지 결정한다 — 설계 문서 7단계.
 *   agency_members에 있으면  /app
 *   client_members에 있으면  /p/{가장 최근 프로젝트 code}
 *   둘 다 없으면             /no-access
 */
export async function resolveHomeForUser(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: agencyMember } = await supabase
    .from('agency_members')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (agencyMember) return '/app'

  // 의뢰인 — 소속 client의 프로젝트 중 가장 최근 것
  const { data: memberships } = await supabase.from('client_members').select('client_id').eq('user_id', userId)

  const clientIds = (memberships ?? []).map((m: { client_id: string }) => m.client_id)
  if (clientIds.length === 0) return '/no-access'

  const { data: project } = await supabase
    .from('projects')
    .select('code')
    .in('client_id', clientIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ code: string }>()

  return project ? `/p/${project.code}` : '/no-access'
}
