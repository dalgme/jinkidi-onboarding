'use server'

import { z } from 'zod'

import { ko } from '@/content/ko'
import { appUrl } from '@/lib/mail/resend'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  email: z.string().trim().email(),
  next: z.string().optional(),
})

export interface LoginResult {
  ok: boolean
  message?: string
}

/**
 * 매직링크 발송.
 *
 * 서버 액션으로 두는 이유는 성능 예산 때문이다 —
 * 브라우저용 Supabase 클라이언트를 로그인 화면에 실으면 첫 페이지 JS가
 * 200KB(gzip) 예산을 넘는다. 발송은 세션이 필요 없는 동작이므로
 * 서버에서 호출해도 동작이 완전히 같다.
 */
export async function sendMagicLink(input: unknown): Promise<LoginResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: ko.auth.invalidEmail }
  }

  const redirectTo = new URL('/auth/callback', appUrl())
  // next는 내부 경로만 허용한다 (open redirect 방지)
  const next = parsed.data.next
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    redirectTo.searchParams.set('next', next)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: redirectTo.toString() },
  })

  if (error) {
    console.error('[auth] signInWithOtp failed', error.message)
    return { ok: false, message: ko.auth.sendFailed }
  }

  return { ok: true }
}
