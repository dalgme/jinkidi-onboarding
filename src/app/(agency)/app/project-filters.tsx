'use client'

import { useRouter, useSearchParams } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ko } from '@/content/ko'
import type { ProjectStatus } from '@/types/database'

const STATUSES: (ProjectStatus | 'all')[] = ['all', 'onboarding', 'building', 'delivered', 'on_hold', 'archived']

export function ProjectFilters({ status, stalledOnly }: { status: ProjectStatus | 'all'; stalledOnly: boolean }) {
  const router = useRouter()
  const params = useSearchParams()

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value === null) next.delete(key)
    else next.set(key, value)
    router.push(`/app?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="w-40">
        <Select value={status} onValueChange={(v) => update('status', v === 'all' ? null : v)}>
          <SelectTrigger aria-label={ko.agency.filterStatus}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'all' ? ko.common.all : ko.agency.projectStatus[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button variant={stalledOnly ? 'default' : 'outline'} onClick={() => update('stalled', stalledOnly ? null : '1')}>
        {ko.agency.filterStalled}
      </Button>

      {stalledOnly ? (
        <Badge variant="pending" className="hidden sm:inline-flex">
          {ko.agency.stalledHint}
        </Badge>
      ) : null}
    </div>
  )
}
