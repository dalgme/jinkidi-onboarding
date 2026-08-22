'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { Checkbox } from '@/components/ui/checkbox'
import { ko } from '@/content/ko'

import { setNotificationOptOut } from './actions'

export function NotificationToggle({
  initialOptedOut,
  scope,
}: {
  initialOptedOut: boolean
  scope: 'agency' | 'client'
}) {
  const [optedOut, setOptedOut] = useState(initialOptedOut)
  const [pending, setPending] = useState(false)

  async function toggle(next: boolean) {
    setPending(true)
    const result = await setNotificationOptOut(scope, next)
    setPending(false)

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    setOptedOut(next)
    toast.success(ko.common.saved)
  }

  return (
    <div className="space-y-3">
      <label className="flex min-h-touch cursor-pointer items-center gap-3">
        <Checkbox
          checked={optedOut}
          disabled={pending}
          onCheckedChange={(c) => void toggle(c === true)}
          aria-label={ko.mail.footerOptOut}
        />
        <span className="text-sm">{ko.mail.optOutToggleLabel}</span>
      </label>
      <p className="text-xs text-muted-foreground">
        {ko.mail.optOutInviteNotice}
      </p>
    </div>
  )
}
