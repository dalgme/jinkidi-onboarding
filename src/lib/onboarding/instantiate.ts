import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { OnboardingTemplateStep } from '@/types/database'

/**
 * 템플릿 단계를 프로젝트로 «복사»한다 — 설계 문서 2.2
 *
 * ⚠ 복사이지 참조가 아니다.
 *   project_steps가 template_step_id를 FK로 참조하면, 6개월 뒤 템플릿 문구를
 *   고쳤을 때 이미 완료된 과거 프로젝트의 단계 내용까지 바뀐다.
 *   분쟁 시 «그때 무엇에 동의했는가»를 증명할 수 없게 된다.
 *
 *   추적용으로 template_step_key(문자열)만 남기고 연결은 끊는다.
 */
export interface InstantiateResult {
  ok: boolean
  created: number
  error?: string
}

export async function createProjectSteps(
  supabase: SupabaseClient,
  projectId: string,
  templateId: string,
): Promise<InstantiateResult> {
  const { data: templateSteps, error: fetchError } = await supabase
    .from('onboarding_template_steps')
    .select('*')
    .eq('template_id', templateId)
    .order('order_index', { ascending: true })
    .returns<OnboardingTemplateStep[]>()

  if (fetchError) {
    return { ok: false, created: 0, error: fetchError.message }
  }
  if (!templateSteps || templateSteps.length === 0) {
    return { ok: true, created: 0 }
  }

  const rows = templateSteps.map((step) => ({
    project_id: projectId,
    order_index: step.order_index,
    key: step.key,
    // 어느 템플릿 단계에서 나왔는지 추적만 한다. FK가 아니다.
    template_step_key: step.key,
    title: step.title,
    description_md: step.description_md,
    owner_side: step.owner_side,
    verify_type: step.verify_type,
    est_minutes: step.est_minutes,
    is_required: step.is_required,
    status: 'pending' as const,
  }))

  /*
   * 단일 insert는 Postgres에서 한 문장이므로 원자적이다 —
   * 일부만 들어간 프로젝트가 남지 않는다.
   */
  const { error: insertError, count } = await supabase
    .from('project_steps')
    .insert(rows, { count: 'exact' })

  if (insertError) {
    return { ok: false, created: 0, error: insertError.message }
  }

  return { ok: true, created: count ?? rows.length }
}
