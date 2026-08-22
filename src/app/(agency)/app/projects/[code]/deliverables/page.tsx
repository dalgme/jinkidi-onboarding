import { Alert, AlertDescription } from '@/components/ui/alert'
import { CommentThread } from '@/components/comment/comment-thread'
import { DeliverableCard } from '@/components/deliverable/deliverable-card'
import { FileUploader } from '@/components/deliverable/file-uploader'
import { LinkForm } from '@/components/deliverable/link-form'
import { EmptyState } from '@/components/common/empty-state'
import { ko } from '@/content/ko'
import { requireAgencyProject } from '@/lib/auth/guards'
import type { Deliverable } from '@/types/database'

export default async function AgencyDeliverablesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, project, side } = await requireAgencyProject(code)

  const { data: deliverables } = await supabase
    .from('deliverables')
    .select('*')
    .eq('project_id', project.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<Deliverable[]>()

  const list = deliverables ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <LinkForm projectCode={code} />
        <FileUploader projectCode={code} />
      </div>

      <Alert variant="info">
        <AlertDescription>{ko.deliverable.draftOnlyNotice}</AlertDescription>
      </Alert>

      {list.length === 0 ? (
        <EmptyState title={ko.deliverable.empty} />
      ) : (
        <div className="space-y-3">
          {list.map((deliverable) => (
            <div key={deliverable.id} className="space-y-3">
              <DeliverableCard projectCode={code} deliverable={deliverable} side={side} />
              <div className="pl-4">
                <CommentThread
                  projectCode={code}
                  projectId={project.id}
                  subjectType="deliverable"
                  subjectId={deliverable.id}
                  currentSide={side}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
