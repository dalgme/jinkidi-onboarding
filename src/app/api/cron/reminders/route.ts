import { NextResponse, type NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { runReminders } from '@/lib/mail/reminders'

/**
 * 정체 리마인더 크론 — Vercel Cron이 매일 1회 호출한다.
 * vercel.json의 "0 1 * * *" = 매일 10:00 KST (UTC+9)
 *
 * 크론은 사용자 세션이 없으므로 service_role로 동작한다.
 * 그래서 CRON_SECRET 검증이 유일한 관문이다 — 없으면 401로 끊는다.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }

  const authorization = request.headers.get('authorization')
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runReminders(createAdminClient())
    console.info('[cron] reminders', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[cron] reminders failed', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
