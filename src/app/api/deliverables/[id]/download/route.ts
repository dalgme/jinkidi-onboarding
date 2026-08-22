import { NextResponse, type NextRequest } from 'next/server'

import { getUser } from '@/lib/auth/guards'
import { SIGNED_URL_TTL_SECONDS, STORAGE_BUCKET } from '@/lib/deliverables/upload-policy'
import type { Deliverable } from '@/types/database'

/**
 * 산출물 다운로드.
 *
 * ⚠ 서명 URL은 «서버에서만» 만든다 (설계 문서 10.5).
 *   클라이언트에서 만들려면 service_role 키가 필요한데, 그 키가 브라우저에 가는 순간
 *   DB 전체가 열린다.
 *
 * 버킷은 private이고, 이 핸들러는 사용자 세션으로 서명한다 —
 * Storage RLS가 프로젝트 접근권을 다시 확인하므로 남의 파일에는 서명이 나가지 않는다.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { supabase, user } = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // RLS가 draft 산출물을 의뢰인에게 보여주지 않으므로, 여기서 보이면 접근권이 있는 것이다
  const { data: deliverable } = await supabase
    .from('deliverables')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle<Deliverable>()

  if (!deliverable || deliverable.kind !== 'file' || !deliverable.storage_path) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(deliverable.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: deliverable.file_name ?? true,
    })

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'sign_failed' }, { status: 500 })
  }

  return NextResponse.redirect(data.signedUrl)
}
