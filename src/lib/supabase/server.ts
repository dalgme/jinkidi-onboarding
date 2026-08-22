import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

interface CookieToSet {
  name: string
  value: string
  options?: CookieOptions
}

/**
 * Server Component / Route Handler / Server Action 용 클라이언트.
 * 사용자의 세션으로 동작하므로 RLS가 그대로 적용된다.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Component에서는 쿠키를 쓸 수 없다. 미들웨어가 갱신을 담당한다.
          }
        },
      },
    },
  )
}
