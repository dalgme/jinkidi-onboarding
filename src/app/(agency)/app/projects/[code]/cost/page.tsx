import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/empty-state'
import { ko } from '@/content/ko'
import { requireAgencyProject } from '@/lib/auth/guards'
import { DEFAULT_COST_INPUTS } from '@/lib/cost/calculator'
import { formatDate, formatKrw, formatUsd } from '@/lib/utils/format'
import type { CostEstimate, CostRate } from '@/types/database'

import { CostCalculator } from './cost-calculator'

export default async function AgencyCostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { supabase, project } = await requireAgencyProject(code)

  const [{ data: rates }, { data: snapshots }] = await Promise.all([
    supabase.from('cost_rates').select('*').eq('agency_id', project.agency_id).returns<CostRate[]>(),
    supabase
      .from('cost_estimates')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false })
      .limit(10)
      .returns<CostEstimate[]>(),
  ])

  if (!rates || rates.length === 0) {
    return <EmptyState title={ko.cost.noRates} />
  }

  const defaults = {
    ...DEFAULT_COST_INPUTS,
    usdKrwRate: Number(process.env.COST_USD_KRW_RATE ?? DEFAULT_COST_INPUTS.usdKrwRate),
  }

  return (
    <div className="space-y-5">
      <Alert variant="info">
        <AlertDescription>{ko.cost.disclaimer}</AlertDescription>
      </Alert>

      <CostCalculator projectCode={code} rates={rates} defaults={defaults} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{ko.cost.snapshotsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {(snapshots ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{ko.cost.snapshotsEmpty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ko.common.createdAt}</TableHead>
                  <TableHead>{ko.cost.monthlyTotal} (USD)</TableHead>
                  <TableHead>{ko.cost.monthlyTotal} (KRW)</TableHead>
                  <TableHead>{ko.cost.ratesBasis('')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(snapshots ?? []).map((snapshot) => (
                  <TableRow key={snapshot.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(snapshot.created_at)}</TableCell>
                    <TableCell className="tabular-nums">{formatUsd(Number(snapshot.monthly_total_usd))}</TableCell>
                    <TableCell className="tabular-nums">{formatKrw(Number(snapshot.monthly_total_krw))}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {snapshot.rates_effective_from}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
