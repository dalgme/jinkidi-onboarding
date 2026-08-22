import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/empty-state'
import { ko } from '@/content/ko'
import { requireProjectAccess } from '@/lib/auth/guards'
import { formatDate, formatKrw, formatUsd } from '@/lib/utils/format'
import type { CostEstimate } from '@/types/database'

interface BreakdownLine {
  service: string
  label: string
  amountUsd: number
}

/** 의뢰인은 최신 스냅샷을 «읽기 전용»으로 본다 */
export default async function PortalCostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, project } = await requireProjectAccess(code)

  const { data: snapshot } = await supabase
    .from('cost_estimates')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<CostEstimate>()

  if (!snapshot) {
    return (
      <div className="space-y-5">
        <h2 className="text-xl font-semibold tracking-tight">{ko.portal.costTitle}</h2>
        <EmptyState title={ko.portal.costEmpty} />
      </div>
    )
  }

  const breakdown = snapshot.breakdown as { lines?: BreakdownLine[] } | null
  const lines = breakdown?.lines ?? []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{ko.portal.costTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ko.cost.ratesBasis(snapshot.rates_effective_from)} · {formatDate(snapshot.created_at)} 산출
        </p>
      </div>

      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{ko.cost.monthlyTotal}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{formatKrw(Number(snapshot.monthly_total_krw))}</p>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {formatUsd(Number(snapshot.monthly_total_usd))} · 환율 {Number(snapshot.usd_krw_rate).toLocaleString('ko-KR')}원
          </p>
        </CardContent>
      </Card>

      {lines.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ko.cost.serviceLabel}</TableHead>
                  <TableHead>{ko.cost.itemLabel}</TableHead>
                  <TableHead className="text-right">{ko.cost.amountLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={`${line.service}-${index}`}>
                    <TableCell className="whitespace-nowrap">{line.service}</TableCell>
                    <TableCell>{line.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(Number(line.amountUsd))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Alert variant="info">
        <AlertDescription>{ko.cost.disclaimer}</AlertDescription>
      </Alert>
    </div>
  )
}
