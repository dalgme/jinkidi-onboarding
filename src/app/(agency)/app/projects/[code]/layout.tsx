import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ko } from '@/content/ko'
import { requireAgencyProject } from '@/lib/auth/guards'
import { calculateProgress } from '@/lib/onboarding/progress'
import type { StepStatus } from '@/types/database'

const TABS = [
  { segment: '', label: ko.nav.overview },
  { segment: '/onboarding', label: ko.nav.onboarding },
  { segment: '/intake', label: ko.nav.intake },
  { segment: '/deliverables', label: ko.nav.deliverables },
  { segment: '/cost', label: ko.nav.cost },
  { segment: '/settings', label: ko.nav.settings },
]

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const { supabase, project } = await requireAgencyProject(code)

  const { data: steps } = await supabase
    .from('project_steps')
    .select('status, is_required')
    .eq('project_id', project.id)
    .returns<{ status: StepStatus; is_required: boolean }[]>()

  const progress = calculateProgress(steps ?? [])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
            <Badge variant="pending">{ko.agency.projectStatus[project.status]}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{project.code}</p>
        </div>
        <div className="flex items-center gap-3 sm:w-64">
          <Progress value={progress.pct} label={ko.onboarding.progress} />
          <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
            {progress.pct}% · {progress.verified}/{progress.total}
          </span>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.segment}
            href={`/app/projects/${code}${tab.segment}`}
            className="flex min-h-touch shrink-0 items-center border-b-2 border-transparent px-3 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  )
}
