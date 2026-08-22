import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Markdown } from '@/components/common/markdown'
import { StepStatusBadge } from '@/components/common/status-badge'
import { CommentThread } from '@/components/comment/comment-thread'
import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import { deepLinkForStep, requiresDomain } from '@/lib/onboarding/deep-links'
import type { ProjectStep } from '@/types/database'

import { DeepLinkCard } from './deep-link-card'
import { OrgSlugForm } from './org-slug-form'
import { StepActions } from './step-actions'

export default async function StepDetailPage({ params }: { params: Promise<{ code: string; key: string }> }) {
  const { code, key } = await params
  const { supabase, project, side } = await requireProjectAccess(code)

  const { data: step } = await supabase
    .from('project_steps')
    .select('*')
    .eq('project_id', project.id)
    .eq('key', key)
    .maybeSingle<ProjectStep>()

  if (!step) notFound()

  const deepLink = deepLinkForStep(step)
  const needsDomain = requiresDomain(step)

  // 조직 slug가 아직 없으면 딥링크를 만들 수 없다 — 화면을 2부로 나눈다 (설계 문서 5.3)
  const slugValue = deepLink ? project[deepLink.slugField] : needsDomain ? project.primary_domain : null
  const hasSlug = typeof slugValue === 'string' && slugValue.length > 0

  const agencyInviteEmail = process.env.NEXT_PUBLIC_AGENCY_INVITE_EMAIL ?? ''

  return (
    <div className="space-y-5">
      <Link
        href={`/p/${code}`}
        className="inline-flex min-h-touch items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {ko.portal.stepDetailBack}
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{step.title}</h2>
          <StepStatusBadge status={step.status} />
        </div>
        {step.est_minutes ? (
          <p className="mt-1 text-sm text-muted-foreground">{ko.onboarding.estimate(step.est_minutes)}</p>
        ) : null}
      </div>

      {step.status === 'blocked' && step.blocked_reason ? (
        <Alert variant="warning">
          <AlertDescription>
            <span className="font-medium">{ko.onboarding.blockedReasonLabel}</span> · {step.blocked_reason}
          </AlertDescription>
        </Alert>
      ) : null}

      {step.description_md ? (
        <Card>
          <CardContent className="py-5">
            <Markdown>{step.description_md}</Markdown>
          </CardContent>
        </Card>
      ) : null}

      {/* 1부: 조직이 아직 없을 때 — 이름을 입력받는다 */}
      {(deepLink || needsDomain) && !hasSlug ? (
        <OrgSlugForm
          projectCode={code}
          field={deepLink ? deepLink.slugField : 'primary_domain'}
          label={deepLink ? deepLink.slugLabel : ko.portal.domainLabel}
          placeholder={deepLink ? deepLink.slugPlaceholder : ko.portal.domainPlaceholder}
        />
      ) : null}

      {/* 2부: 이름이 입력되면 그때 딥링크 카드가 나타난다 */}
      {deepLink && hasSlug && typeof slugValue === 'string' ? (
        <DeepLinkCard spec={deepLink} slug={slugValue} agencyEmail={agencyInviteEmail} />
      ) : null}

      {needsDomain && hasSlug && typeof slugValue === 'string' ? (
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-muted-foreground">{ko.portal.domainLabel}</p>
            <p className="mt-1 text-lg font-medium">{slugValue}</p>
          </CardContent>
        </Card>
      ) : null}

      <CommentThread
        projectCode={code}
        projectId={project.id}
        subjectType="step"
        subjectId={step.id}
        currentSide={side}
      />

      {/* 하단 sticky — 모바일에서 항상 손에 닿는 곳에 둔다 */}
      {side === 'client' ? <StepActions projectCode={code} step={step} /> : null}
    </div>
  )
}
