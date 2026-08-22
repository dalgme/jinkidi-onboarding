'use client'

import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ko } from '@/content/ko'

import { requestNewInviteLink } from './actions'

export function RequestNewLinkButton({ inviteId }: { inviteId: string }) {
  const [state, setState] = useState<{ done: boolean; message: string | null }>({ done: false, message: null })
  const [pending, setPending] = useState(false)

  async function request() {
    setPending(true)
    const result = await requestNewInviteLink(inviteId)
    setState({ done: result.ok, message: result.message })
    setPending(false)
  }

  if (state.done) {
    return (
      <Alert variant="success">
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" size="lg" disabled={pending} onClick={() => void request()}>
        {ko.invite.requestNew}
      </Button>
      {state.message ? <p className="text-sm text-destructive">{state.message}</p> : null}
    </div>
  )
}
