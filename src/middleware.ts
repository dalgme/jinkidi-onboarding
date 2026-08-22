import { NextResponse, type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

/**
 * 세션 갱신 + 1차 접근 제어 — 설계 문서 8단계.
 *
 * ⚠ 미들웨어만 믿지 않는다. matcher 실수 한 번이면 통째로 우회된다.
 *   각 페이지·Route Handler에서 guards.ts의 가드를 다시 호출하고,
 *   RLS가 최종 방어선으로 남는다 (삼중 방어).
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname, search } = request.nextUrl

  const isProtected = pathname.startsWith('/app') || pathname.startsWith('/p/')

  if (isProtected && !user) {
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.search = ''
    login.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(login)
  }

  // 이미 로그인한 사용자가 /login에 들어오면 홈으로 되돌린다
  if (pathname === '/login' && user) {
    const home = request.nextUrl.clone()
    home.pathname = '/'
    home.search = ''
    return NextResponse.redirect(home)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 정적 파일과 이미지 최적화 요청을 제외한 전 경로.
     * robots.txt·favicon 등도 제외한다.
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
