'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ko } from '@/content/ko'
import type { ProjectStatus } from '@/types/database'

import { updateProjectStatus } from './actions'

const STATUSES: ProjectStatus[] = ['onboarding', 'building', 'delivered', 'on_hold', 'archived']

export function ProjectStatusForm({ projectCode, status }: { projectCode: string; status: ProjectStatus }) {
  const router = useRouter()

  async function change(next: string) {
    const result = await updateProjectStatus(projectCode, next)
    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.common.saved)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{ko.agency.colStatus}</CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={status} onValueChange={(v) => void change(v)}>
          <SelectTrigger aria-label={ko.agency.colStatus}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ko.agency.projectStatus[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
