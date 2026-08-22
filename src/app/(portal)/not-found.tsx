import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ko } from '@/content/ko'

/**
 * 의뢰인이 접근권 없는 프로젝트 code로 들어왔을 때.
 *
 * 403이 아니라 404를 주는 이유는 타사 프로젝트 code의 «존재 여부» 자체를
 * 알 수 없게 하기 위함이다 (설계 문서 8단계).
 * 문구도 「권한이 없습니다」가 아니라 「찾을 수 없습니다」여야 한다.
 */
export default function PortalNotFound() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{ko.common.notFoundTitle}</CardTitle>
        <CardDescription>{ko.common.notFoundBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{ko.invite.expiredBody}</p>
      </CardContent>
    </Card>
  )
}
