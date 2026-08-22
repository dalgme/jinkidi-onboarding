'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * 브라우저용 Supabase 클라이언트.
 *
 * 현재 화면은 모두 Server Component + 서버 액션으로 동작하므로 이 클라이언트를
 * 쓰는 곳이 없다 — 로그인·로그아웃도 서버 액션이다 (성능 예산 §14).
 * Realtime 구독처럼 브라우저에서 세션이 필요한 기능을 붙일 때 쓴다.
 * 무심코 가져다 쓰면 첫 페이지 JS가 100KB 가까이 늘어난다는 점에 유의한다.
 */

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
