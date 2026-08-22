import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ko } from '@/content/ko'
import { requireAgencyProject } from '@/lib/auth/guards'
import { formatDateTime } from '@/lib/utils/format'
import type { ClientMember } from '@/types/database'

import { OrgInfoCard } from '../org-info-card'
import { ProjectStatusForm } from './project-status-form'

export default async function ProjectSettingsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, project } = await requireAgencyProject(code)

  const { data: members } = await supabase
    .from('client_members')
    .select('*')
    .eq('client_id', project.client_id)
    .returns<ClientMember[]>()

  const list = members ?? []
  const owners = list.filter((m) => m.role === 'owner')

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <OrgInfoCard project={project} />

      <ProjectStatusForm projectCode={code} status={project.status} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {ko.agency.clientsTitle} · {list.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{ko.common.emptyTitle}</p>
          ) : (
            <ul className="space-y-2">
              {list.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{member.display_name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(member.created_at)}</p>
                  </div>
                  <Badge variant={member.role === 'owner' ? 'client' : 'outline'}>
                    {member.role === 'owner' ? ko.agency.inviteRoleOwner : ko.agency.inviteRoleMember}
                  </Badge>
                </li>
              ))}
            </ul>
          )}

          {owners.length === 1 ? (
            <p className="mt-3 rounded-md bg-status-blocked-bg px-3 py-2 text-xs text-status-blocked-fg">
              {ko.onboarding.soleOwnerWarningBody}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
