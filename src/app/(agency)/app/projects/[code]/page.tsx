import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/empty-state'
import { ko } from '@/content/ko'
import { requireAgencyProject } from '@/lib/auth/guards'
import { formatDateTime, formatRelative } from '@/lib/utils/format'
import type { AuditLog, Client } from '@/types/database'

import { OrgInfoCard } from './org-info-card'
import { InvitePanel } from './invite-panel'

export default async function ProjectOverviewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, project } = await requireAgencyProject(code)

  const [{ data: client }, { data: logs }, { data: invites }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', project.client_id).maybeSingle<Client>(),
    supabase
      .from('audit_logs')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .returns<AuditLog[]>(),
    supabase
      .from('project_invites')
      .select('id, email, role, expires_at, accepted_at, revoked_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .returns<
        { id: string; email: string; role: string; expires_at: string; accepted_at: string | null; revoked_at: string | null }[]
      >(),
  ])

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <OrgInfoCard project={project} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ko.agency.timelineTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {(logs ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{ko.agency.timelineEmpty}</p>
            ) : (
              <ul className="space-y-3">
                {(logs ?? []).map((log) => (
                  <li key={log.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="truncate text-xs text-muted-foreground">{JSON.stringify(log.meta)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {log.actor_side ? (
                        <Badge variant={log.actor_side === 'agency' ? 'agency' : 'client'}>
                          {log.actor_side === 'agency' ? ko.comment.sideAgency : ko.comment.sideClient}
                        </Badge>
                      ) : null}
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatRelative(log.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ko.agency.clientsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {client ? (
              <>
                <Row label={ko.agency.clientNameLabel} value={client.name} />
                <Row label={ko.agency.clientContactNameLabel} value={client.contact_name} />
                <Row label={ko.agency.clientContactEmailLabel} value={client.contact_email} />
                <Row label={ko.agency.clientContactPhoneLabel} value={client.contact_phone} />
              </>
            ) : (
              <EmptyState title={ko.common.emptyTitle} />
            )}
            <div className="pt-2">
              <Link
                href={`/p/${project.code}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-sm underline underline-offset-4"
              >
                의뢰인 화면 미리 보기
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </CardContent>
        </Card>

        <InvitePanel projectCode={project.code} invites={invites ?? []} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ko.common.lastUpdated}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={ko.onboarding.lastClientActivity} value={formatDateTime(project.last_client_activity_at)} />
            <Row label={ko.agency.projectTargetLaunchLabel} value={formatDateTime(project.target_launch_at)} />
            <Row label={ko.common.createdAt} value={formatDateTime(project.created_at)} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right">{value && value !== '—' ? value : '—'}</span>
    </div>
  )
}
