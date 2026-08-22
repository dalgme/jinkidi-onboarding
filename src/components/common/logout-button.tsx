'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ko } from '@/content/ko'

import { logout } from './logout-action'

export function LogoutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false)

  return (
    <Button
      variant="outline"
      className={className}
      disabled={pending}
      onClick={() => {
        setPending(true)
        void logout()
      }}
    >
      <LogOut aria-hidden />
      {ko.common.logout}
    </Button>
  )
}
