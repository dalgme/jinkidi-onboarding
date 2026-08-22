import type { Metadata } from 'next'

import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { ko } from '@/content/ko'
import { requireAgencyMember } from '@/lib/auth/guards'
import type { Client, OnboardingTemplate } from '@/types/database'
import Link from 'next/link'

import { NewProjectForm } from './new-project-form'

export const metadata: Metadata = { title: ko.agency.projectNew }

export default async function NewProjectPage() {
  const { supabase } = await requireAgencyMember()

  const [{ data: clients }, { data: templates }] = await Promise.all([
    supabase.from('clients').select('*').is('deleted_at', null).order('name').returns<Client[]>(),
    supabase
      .from('onboarding_templates')
      .select('*')
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .returns<OnboardingTemplate[]>(),
  ])

  if (!clients || clients.length === 0) {
    return (
      <>
        <PageHeader title={ko.agency.projectNew} />
        <EmptyState
          title={ko.agency.clientsEmpty}
          action={
            <Button asChild>
              <Link href="/app/clients">{ko.agency.clientNew}</Link>
            </Button>
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title={ko.agency.projectNew} description={ko.agency.templateCopyNotice} />
      <NewProjectForm clients={clients} templates={templates ?? []} />
    </>
  )
}
