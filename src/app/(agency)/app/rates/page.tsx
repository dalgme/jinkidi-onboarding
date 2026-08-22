import type { Metadata } from 'next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { ko } from '@/content/ko'
import { requireAgencyRole } from '@/lib/auth/guards'
import { formatUsd } from '@/lib/utils/format'
import type { CostRate } from '@/types/database'

import { NewRateDialog } from './new-rate-dialog'

export const metadata: Metadata = { title: ko.agency.ratesTitle }

export default async function RatesPage() {
  const { supabase, member } = await requireAgencyRole('owner')

  const { data: rates } = await supabase
    .from('cost_rates')
    .select('*')
    .eq('agency_id', member.agency_id)
    .order('service')
    .order('effective_from', { ascending: false })
    .returns<CostRate[]>()

  const list = rates ?? []

  return (
    <>
      <PageHeader title={ko.agency.ratesTitle} actions={<NewRateDialog />} />

      <Alert variant="warning" className="mb-5">
        <AlertDescription>{ko.agency.ratesHelp}</AlertDescription>
      </Alert>

      {list.length === 0 ? (
        <EmptyState title={ko.cost.noRates} action={<NewRateDialog />} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ko.cost.serviceLabel}</TableHead>
                <TableHead>{ko.agency.ratePlanLabel}</TableHead>
                <TableHead>{ko.cost.itemLabel}</TableHead>
                <TableHead className="text-right">{ko.cost.includedLabel}</TableHead>
                <TableHead className="text-right">{ko.agency.rateUnitPriceLabel}</TableHead>
                <TableHead className="text-right">{ko.agency.rateFixedPriceLabel}</TableHead>
                <TableHead>{ko.agency.rateEffectiveFromLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="whitespace-nowrap">{rate.service}</TableCell>
                  <TableCell className="whitespace-nowrap">{rate.plan}</TableCell>
                  <TableCell>{rate.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(rate.included_qty)} {rate.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(Number(rate.unit_price_usd))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsd(Number(rate.fixed_price_usd))}</TableCell>
                  <TableCell className="whitespace-nowrap">{rate.effective_from}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}
