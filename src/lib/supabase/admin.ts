import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * service_role 클라이언트 — RLS를 우회한다.
 *
 * 절대 클라이언트 번들에 들어가면 안 된다. `import 'server-only'`가 그것을 강제한다.
 * 다음 세 경우에만 쓴다.
 *   1. 초대 토큰 대조 (로그인 전이라 세션이 없다)
 *   2. 크론 (사용자 세션이 없다)
 *   3. 알림 발송 이력 기록
 * 그 외에는 사용자 세션 클라이언트를 써서 RLS를 최종 방어선으로 남긴다.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
