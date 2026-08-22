'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ko } from '@/content/ko'
import { calculateCost, type CostInputs } from '@/lib/cost/calculator'
import { formatKrw, formatUsd } from '@/lib/utils/format'
import type { CostRate } from '@/types/database'

import { saveCostSnapshot } from './actions'

const FIELDS: { key: keyof CostInputs; label: string; step?: string }[] = [
  { key: 'monthlyVisitors', label: ko.cost.visitorsLabel },
  { key: 'dbSizeGb', label: ko.cost.dbSizeLabel, step: '0.1' },
  { key: 'storageGb', label: ko.cost.storageLabel, step: '0.1' },
  { key: 'monthlyEmails', label: ko.cost.emailsLabel },
  { key: 'seats', label: ko.cost.seatsLabel },
  { key: 'rate' as keyof CostInputs, label: ko.cost.rateLabel },
]

export function CostCalculator({
  projectCode,
  rates,
  defaults,
}: {
  projectCode: string
  rates: CostRate[]
  defaults: CostInputs
}) {
  const router = useRouter()
  const [inputs, setInputs] = useState<CostInputs>(defaults)
  const [saving, setSaving] = useState(false)

  // 요율은 DB에서 온 것만 쓴다. 계산은 순수 함수라 입력이 바뀌면 즉시 반영된다.
  const breakdown = useMemo(() => calculateCost(inputs, rates), [inputs, rates])

  async function save() {
    setSaving(true)
    const result = await saveCostSnapshot({ projectCode, ...inputs })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.cost.snapshotSaved)
    router.refresh()
  }

  function update(key: keyof CostInputs, value: string) {
    const parsed = Number(value)
    setInputs((prev) => ({ ...prev, [key]: Number.isFinite(parsed) ? parsed : 0 }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{ko.cost.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{ko.cost.subtitle}</p>
        {/* 요율 기준일을 «항상» 표시한다 */}
        <p className="text-xs font-medium">{ko.cost.ratesBasis(breakdown.ratesEffectiveFrom)}</p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.filter((f) => f.key !== ('rate' as keyof CostInputs)).map((field) => (
            <div key={String(field.key)} className="space-y-2">
              <Label htmlFor={`cost-${String(field.key)}`}>{field.label}</Label>
              <Input
                id={`cost-${String(field.key)}`}
                type="number"
                min={0}
                step={field.step}
                value={String(inputs[field.key])}
                onChange={(e) => update(field.key, e.target.value)}
              />
            </div>
          ))}
          <div className="space-y-2">
            <Label htmlFor="cost-rate">{ko.cost.rateLabel}</Label>
            <Input
              id="cost-rate"
              type="number"
              min={1}
              value={String(inputs.usdKrwRate)}
              onChange={(e) => update('usdKrwRate', e.target.value)}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">{ko.cost.breakdownTitle}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ko.cost.serviceLabel}</TableHead>
                <TableHead>{ko.cost.itemLabel}</TableHead>
                <TableHead className="text-right">{ko.cost.qtyLabel}</TableHead>
                <TableHead className="text-right">{ko.cost.includedLabel}</TableHead>
                <TableHead className="text-right">{ko.cost.billableLabel}</TableHead>
                <TableHead className="text-right">{ko.cost.amountLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.lines.map((line) => (
                <TableRow key={`${line.service}-${line.plan}-${line.itemKey}`}>
                  <TableCell className="whitespace-nowrap">{line.service}</TableCell>
                  <TableCell>{line.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.usage} {line.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{line.included}</TableCell>
                  <TableCell className="text-right tabular-nums">{line.billable}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatUsd(line.amountUsd)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted p-4">
          <div>
            <p className="text-xs text-muted-foreground">{ko.cost.monthlyTotal}</p>
            <p className="text-2xl font-semibold tabular-nums">{formatUsd(breakdown.monthlyTotalUsd)}</p>
            <p className="text-sm text-muted-foreground tabular-nums">{formatKrw(breakdown.monthlyTotalKrw)}</p>
          </div>
          <Button size="lg" disabled={saving} onClick={() => void save()}>
            {saving ? ko.common.saving : ko.cost.saveSnapshot}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
