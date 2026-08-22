'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, CircleDashed, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ko } from '@/content/ko'
import { formatDateTime } from '@/lib/utils/format'
import type { ProjectStep, VerifyResultRecord } from '@/types/database'

/**
 * 검증 버튼.
 *
 * 결과는 3상태를 «시각적으로도» 구분한다 —
 *   verified  초록 «확인됨»
 *   not_found 회색 «아직 확인되지 않음»
 *   error     붉은 배지 + 오류 원문 그대로
 *
 * error를 회색으로 뭉뚱그리면 개발사가 토큰 만료를 「의뢰인이 안 함」으로 오해한다.
 */
export function VerifyButton({ projectCode, step }: { projectCode: string; step: ProjectStep }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<VerifyResultRecord | null>(step.verify_result)

  async function run() {
    setRunning(true)
    try {
      const response = await fetch(`/api/verify/${step.verify_type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectCode, stepId: step.id }),
      })

      const body: unknown = await response.json()
      if (isVerifyResponse(body)) {
        setResult(body.result)
      }
      router.refresh()
    } catch (e) {
      setResult({
        status: 'error',
        error: e instanceof Error ? e.message : ko.common.unknownError,
        checkedAt: new Date().toISOString(),
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex w-full flex-wrap items-start gap-3">
      <Button variant="outline" size="sm" disabled={running} onClick={() => void run()}>
        <ShieldCheck aria-hidden />
        {running ? ko.onboarding.verifyRunning : ko.onboarding.verifyRun}
      </Button>

      <div className="min-w-0 flex-1">
        {result === null ? (
          <p className="text-xs text-muted-foreground">{ko.onboarding.verifyNever}</p>
        ) : (
          <VerifyResultView result={result} />
        )}
      </div>
    </div>
  )
}

function VerifyResultView({ result }: { result: VerifyResultRecord }) {
  const checkedAt = ko.onboarding.verifyLastRun(formatDateTime(result.checkedAt))

  if (result.status === 'verified') {
    return (
      <div className="text-xs">
        <p className="inline-flex items-center gap-1.5 font-medium text-status-verified-fg">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {ko.onboarding.verifyVerified}
        </p>
        {result.detail ? <p className="mt-0.5 text-muted-foreground">{result.detail}</p> : null}
        <p className="mt-0.5 text-muted-foreground">{checkedAt}</p>
      </div>
    )
  }

  if (result.status === 'not_found') {
    return (
      <div className="text-xs">
        <p className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <CircleDashed className="h-3.5 w-3.5" aria-hidden />
          {ko.onboarding.verifyNotFound}
        </p>
        {result.detail ? <p className="mt-0.5 text-muted-foreground">{result.detail}</p> : null}
        <p className="mt-0.5 text-muted-foreground">{checkedAt}</p>
      </div>
    )
  }

  // error — 원문을 그대로 노출한다. «Bad credentials»가 보이면 즉시 토큰 문제임을 안다.
  return (
    <div className="rounded-md bg-status-blocked-bg px-3 py-2 text-xs text-status-blocked-fg">
      <p className="inline-flex items-center gap-1.5 font-semibold">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        {ko.onboarding.verifyError}
      </p>
      <p className="mt-1 break-words font-mono text-[11px] leading-relaxed">{result.error}</p>
      <p className="mt-1 opacity-80">{ko.onboarding.verifyErrorHint}</p>
      <p className="mt-0.5 opacity-80">{checkedAt}</p>
    </div>
  )
}

interface VerifyResponse {
  result: VerifyResultRecord
}

function isVerifyResponse(body: unknown): body is VerifyResponse {
  if (typeof body !== 'object' || body === null || !('result' in body)) return false
  const result = (body as { result: unknown }).result
  return typeof result === 'object' && result !== null && 'status' in result
}
