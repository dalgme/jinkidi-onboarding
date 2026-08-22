import { Alert, AlertDescription } from '@/components/ui/alert'
import { CommentThread } from '@/components/comment/comment-thread'
import { DeliverableCard } from '@/components/deliverable/deliverable-card'
import { EmptyState } from '@/components/common/empty-state'
import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import type { Deliverable } from '@/types/database'

export default async function PortalDeliverablesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, project, side } = await requireProjectAccess(code)

  /*
   * RLS가 draft를 걸러주지만, 화면에서도 명시적으로 shared 이상만 요청한다.
   * 「보이면 안 되는 것이 보이지 않는다」를 두 겹으로 보장한다.
   */
  const { data: deliverables } = await supabase
    .from('deliverables')
    .select('*')
    .eq('project_id', project.id)
    .in('status', ['shared', 'approved'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<Deliverable[]>()

  const list = deliverables ?? []

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold tracking-tight">{ko.portal.deliverablesTitle}</h2>

      {list.length === 0 ? (
        <EmptyState title={ko.portal.deliverablesEmpty} />
      ) : (
        <>
          <Alert variant="warning">
            <AlertDescription>{ko.deliverable.sensitiveWarning}</AlertDescription>
          </Alert>

          <div className="space-y-5">
            {list.map((deliverable) => (
              <div key={deliverable.id} className="space-y-3">
                <DeliverableCard projectCode={code} deliverable={deliverable} side={side} />
                <CommentThread
                  projectCode={code}
                  projectId={project.id}
                  subjectType="deliverable"
                  subjectId={deliverable.id}
                  currentSide={side}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
