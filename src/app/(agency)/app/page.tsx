import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { ko } from '@/content/ko'
import { requireAgencyMember } from '@/lib/auth/guards'
import { listProjects } from '@/lib/projects/queries'
import { formatRelative } from '@/lib/utils/format'
import type { ProjectStatus } from '@/types/database'

import { ProjectFilters } from './project-filters'

export const metadata: Metadata = { title: ko.agency.projectsTitle }

const STATUS_VARIANT: Record<ProjectStatus, 'progress' | 'verified' | 'pending' | 'blocked' | 'skipped'> = {
  onboarding: 'progress',
  building: 'progress',
  delivered: 'verified',
  on_hold: 'blocked',
  archived: 'skipped',
}

export default async function AgencyProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; stalled?: string }>
}) {
  const { supabase } = await requireAgencyMember()
  const params = await searchParams

  const status = (params.status ?? 'all') as ProjectStatus | 'all'
  const stalledOnly = params.stalled === '1'

  const summaries = await listProjects(supabase, { status, stalledOnly })

  return (
    <>
      <PageHeader
        title={ko.agency.projectsTitle}
        actions={
          <Button asChild>
            <Link href="/app/projects/new">
              <Plus aria-hidden />
              {ko.agency.projectNew}
            </Link>
          </Button>
        }
      />

      <ProjectFilters status={status} stalledOnly={stalledOnly} />

      {summaries.length === 0 ? (
        <EmptyState
          title={ko.agency.projectsEmpty}
          action={
            <Button asChild>
              <Link href="/app/projects/new">{ko.agency.projectsEmptyCta}</Link>
            </Button>
          }
          className="mt-4"
        />
      ) : (
        <Card className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ko.agency.colName}</TableHead>
                <TableHead>{ko.agency.colClient}</TableHead>
                <TableHead>{ko.agency.colStatus}</TableHead>
                <TableHead className="w-44">{ko.agency.colProgress}</TableHead>
                <TableHead>{ko.agency.colLastActivity}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map(({ project, progressPct, verifiedCount, requiredCount, idleDays, stalled }) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link href={`/app/projects/${project.code}`} className="font-medium underline-offset-4 hover:underline">
                      {project.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{project.code}</p>
                  </TableCell>
                  <TableCell className="text-sm">{project.clients?.name ?? ko.common.dash}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[project.status]}>{ko.agency.projectStatus[project.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={progressPct} className="w-20" label={ko.onboarding.progress} />
                      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                        {progressPct}% · {verifiedCount}/{requiredCount}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-nowrap text-sm">
                      {formatRelative(project.last_client_activity_at ?? project.created_at)}
                    </span>
                    {stalled && idleDays !== null ? (
                      <Badge variant="blocked" className="ml-2">
                        {ko.onboarding.stalledDays(idleDays)}
                      </Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}
