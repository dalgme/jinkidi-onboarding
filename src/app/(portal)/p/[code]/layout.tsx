import Link from 'next/link'
import { FileText, Home, Receipt, Wallet } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import { calculateProgress } from '@/lib/onboarding/progress'
import type { StepStatus } from '@/types/database'

export default async function PortalProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const { supabase, project } = await requireProjectAccess(code)

  const { data: steps } = await supabase
    .from('project_steps')
    .select('status, is_required')
    .eq('project_id', project.id)
    .returns<{ status: StepStatus; is_required: boolean }[]>()

  const progress = calculateProgress(steps ?? [])

  const nav = [
    { href: `/p/${code}`, label: ko.nav.portalHome, icon: Home },
    { href: `/p/${code}/intake`, label: ko.nav.intake, icon: FileText },
    { href: `/p/${code}/deliverables`, label: ko.nav.deliverables, icon: Receipt },
    { href: `/p/${code}/cost`, label: ko.nav.cost, icon: Wallet },
  ]

  return (
    <>
      {/* 상단 미니 헤더 — 프로젝트명 + 진행률만 */}
      <header className="mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{project.name}</h1>
          <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
            {ko.onboarding.progressOf(progress.verified, progress.total)}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Progress value={progress.pct} label={ko.onboarding.progress} />
          <span className="shrink-0 text-sm font-medium tabular-nums">{progress.pct}%</span>
        </div>

        <nav className="mt-4 flex gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-full border bg-background px-4 text-sm hover:bg-accent"
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {children}
    </>
  )
}
