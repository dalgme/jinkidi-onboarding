import type { Metadata } from 'next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { ko } from '@/content/ko'
import { requireAgencyRole } from '@/lib/auth/guards'
import type { OnboardingTemplate, OnboardingTemplateStep } from '@/types/database'

import { TemplateStepList } from './template-step-list'
import { NewTemplateDialog } from './new-template-dialog'

export const metadata: Metadata = { title: ko.agency.templatesTitle }

export default async function TemplatesPage() {
  const { supabase } = await requireAgencyRole('admin')

  const { data: templates } = await supabase
    .from('onboarding_templates')
    .select('*')
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .returns<OnboardingTemplate[]>()

  const list = templates ?? []

  const { data: allSteps } = await supabase
    .from('onboarding_template_steps')
    .select('*')
    .in('template_id', list.map((t) => t.id).length > 0 ? list.map((t) => t.id) : ['00000000-0000-0000-0000-000000000000'])
    .order('order_index', { ascending: true })
    .returns<OnboardingTemplateStep[]>()

  const stepsByTemplate = new Map<string, OnboardingTemplateStep[]>()
  for (const step of allSteps ?? []) {
    stepsByTemplate.set(step.template_id, [...(stepsByTemplate.get(step.template_id) ?? []), step])
  }

  return (
    <>
      <PageHeader title={ko.agency.templatesTitle} actions={<NewTemplateDialog />} />

      <Alert variant="info" className="mb-5">
        <AlertDescription>{ko.agency.templateCopyNotice}</AlertDescription>
      </Alert>

      {list.length === 0 ? (
        <EmptyState title={ko.agency.templatesEmpty} action={<NewTemplateDialog />} />
      ) : (
        <div className="space-y-5">
          {list.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {template.name}
                  {template.is_default ? <Badge variant="verified">{ko.agency.templateDefault}</Badge> : null}
                </CardTitle>
                {template.description ? (
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                ) : null}
              </CardHeader>
              <CardContent>
                <TemplateStepList templateId={template.id} steps={stepsByTemplate.get(template.id) ?? []} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
