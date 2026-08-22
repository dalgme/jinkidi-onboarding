'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ko } from '@/content/ko'
import { suggestProjectCode } from '@/lib/onboarding/slug'
import type { Client, OnboardingTemplate } from '@/types/database'

import { createProject, projectSchema, type ProjectInput } from './actions'

export function NewProjectForm({ clients, templates }: { clients: Client[]; templates: OnboardingTemplate[] }) {
  const router = useRouter()
  const defaultTemplate = templates.find((t) => t.is_default) ?? templates[0]

  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      clientId: clients[0]?.id ?? '',
      name: '',
      code: '',
      templateId: defaultTemplate?.id ?? '',
      targetLaunchAt: '',
    },
  })

  async function onSubmit(values: ProjectInput) {
    const result = await createProject(values)
    if (!result.ok || !result.code) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.common.saved)
    router.push(`/app/projects/${result.code}`)
  }

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="project-client">
              {ko.agency.projectClientLabel} <span className="text-destructive">*</span>
            </Label>
            <Select value={form.watch('clientId')} onValueChange={(v) => form.setValue('clientId', v)}>
              <SelectTrigger id="project-client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-name">
              {ko.agency.projectNameLabel} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project-name"
              {...form.register('name', {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  // code를 아직 손대지 않았다면 프로젝트명에서 제안한다
                  if (!form.formState.dirtyFields.code) {
                    form.setValue('code', suggestProjectCode(e.target.value))
                  }
                },
              })}
            />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-code">
              {ko.agency.projectCodeLabel} <span className="text-destructive">*</span>
            </Label>
            <Input id="project-code" inputMode="url" placeholder="acme-shop" {...form.register('code')} />
            <p className="text-xs text-muted-foreground">{ko.agency.projectCodeHelp}</p>
            {form.formState.errors.code ? (
              <p className="text-sm text-destructive">{form.formState.errors.code.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-template">
              {ko.agency.projectTemplateLabel} <span className="text-destructive">*</span>
            </Label>
            <Select value={form.watch('templateId')} onValueChange={(v) => form.setValue('templateId', v)}>
              <SelectTrigger id="project-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                    {template.is_default ? ` (${ko.agency.templateDefault})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-launch">{ko.agency.projectTargetLaunchLabel}</Label>
            <Input id="project-launch" type="date" {...form.register('targetLaunchAt')} />
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? ko.common.saving : ko.agency.projectNew}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
