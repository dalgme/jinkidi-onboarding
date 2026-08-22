'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

/**
 * 로그아웃.
 * 서버 액션으로 두면 브라우저용 Supabase 클라이언트를 전 화면에 실을 필요가 없다
 * (로그아웃 버튼은 모든 레이아웃에 들어간다).
 */
export async function logout(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
