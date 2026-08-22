import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { resolveHomeForUser } from '@/lib/auth/home'

/** 랜딩 — 로그인 상태에 따라 역할별 홈으로 보낸다 (설계 문서 5.1) */
export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  redirect(await resolveHomeForUser(supabase, user.id))
}
