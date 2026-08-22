import { EmptyState } from '@/components/common/empty-state'
import { ko } from '@/content/ko'

export default function AgencyNotFound() {
  return <EmptyState title={ko.common.notFoundTitle} description={ko.common.notFoundBody} />
}
