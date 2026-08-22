'use client'

import { useRouter } from 'next/navigation'
import { Download, ExternalLink, Eye, EyeOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ko } from '@/content/ko'
import { formatBytes, formatDateTime } from '@/lib/utils/format'
import type { Deliverable, Side } from '@/types/database'

import {
  approveDeliverable,
  deleteDeliverable,
  setDeliverableStatus,
} from '@/app/(agency)/app/projects/[code]/deliverables/actions'

const STATUS_VARIANT = { draft: 'pending', shared: 'progress', approved: 'verified' } as const

export function DeliverableCard({
  projectCode,
  deliverable,
  side,
}: {
  projectCode: string
  deliverable: Deliverable
  side: Side
}) {
  const router = useRouter()

  async function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    const result = await action()
    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.common.saved)
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{deliverable.title}</h3>
              <Badge variant={STATUS_VARIANT[deliverable.status]}>{ko.deliverable.status[deliverable.status]}</Badge>
              {deliverable.version ? <Badge variant="outline">{deliverable.version}</Badge> : null}
            </div>
            {deliverable.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{deliverable.description}</p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(deliverable.created_at)}
              {deliverable.kind === 'file' && deliverable.file_size
                ? ` · ${deliverable.file_name} · ${formatBytes(deliverable.file_size)}`
                : null}
              {deliverable.approved_at ? ` · ${ko.deliverable.approvedAt} ${formatDateTime(deliverable.approved_at)}` : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {deliverable.kind === 'link' && deliverable.url ? (
            <Button asChild variant="outline" size="sm">
              <a href={deliverable.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                {ko.common.open}
              </a>
            </Button>
          ) : null}

          {deliverable.kind === 'file' ? (
            <Button asChild variant="outline" size="sm">
              {/* 서명 URL은 서버에서 발급한다 */}
              <a href={`/api/deliverables/${deliverable.id}/download`}>
                <Download aria-hidden />
                {ko.portal.download}
              </a>
            </Button>
          ) : null}

          {side === 'agency' ? (
            <>
              {deliverable.status === 'draft' ? (
                <Button
                  size="sm"
                  onClick={() => void run(() => setDeliverableStatus(projectCode, deliverable.id, 'shared'))}
                >
                  <Eye aria-hidden />
                  {ko.deliverable.share}
                </Button>
              ) : deliverable.status === 'shared' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void run(() => setDeliverableStatus(projectCode, deliverable.id, 'draft'))}
                >
                  <EyeOff aria-hidden />
                  {ko.deliverable.unshare}
                </Button>
              ) : null}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => void run(() => deleteDeliverable(projectCode, deliverable.id))}
              >
                <Trash2 aria-hidden />
                {ko.common.delete}
              </Button>
            </>
          ) : deliverable.status === 'shared' ? (
            <Button size="sm" onClick={() => void run(() => approveDeliverable(projectCode, deliverable.id))}>
              {ko.portal.approve}
            </Button>
          ) : deliverable.status === 'approved' ? (
            <Badge variant="verified">{ko.portal.approved}</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
