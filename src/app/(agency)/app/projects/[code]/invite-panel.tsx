'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ko } from '@/content/ko'
import { formatDate } from '@/lib/utils/format'

import { revokeInvite, sendProjectInvite } from './actions'

interface InviteRow {
  id: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
}

export function InvitePanel({ projectCode, invites }: { projectCode: string; invites: InviteRow[] }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'owner' | 'member'>('owner')
  const [pending, setPending] = useState(false)

  async function send() {
    setPending(true)
    const result = await sendProjectInvite({ projectCode, email, role })
    setPending(false)

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(result.message ?? ko.agency.inviteSent)
    setEmail('')
    router.refresh()
  }

  async function revoke(inviteId: string) {
    const result = await revokeInvite(projectCode, inviteId)
    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    router.refresh()
  }

  const activeInvites = invites.filter((i) => !i.revoked_at)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{ko.agency.inviteTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-email">{ko.agency.inviteEmailLabel}</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={ko.auth.emailPlaceholder}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="invite-role">{ko.agency.inviteRoleLabel}</Label>
          <Select value={role} onValueChange={(v) => setRole(v as 'owner' | 'member')}>
            <SelectTrigger id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">{ko.agency.inviteRoleOwner}</SelectItem>
              <SelectItem value="member">{ko.agency.inviteRoleMember}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button className="w-full" disabled={pending || email.trim() === ''} onClick={() => void send()}>
          <Send aria-hidden />
          {pending ? ko.auth.sending : ko.agency.inviteSend}
        </Button>

        {activeInvites.length > 0 ? (
          <ul className="space-y-2 border-t pt-3">
            {activeInvites.map((invite) => {
              const expired = !invite.accepted_at && new Date(invite.expires_at).getTime() < Date.now()
              return (
                <li key={invite.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(invite.expires_at)}까지</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {invite.accepted_at ? (
                      <Badge variant="verified">{ko.agency.inviteAccepted}</Badge>
                    ) : expired ? (
                      <Badge variant="blocked">{ko.agency.inviteExpired}</Badge>
                    ) : (
                      <>
                        <Badge variant="pending">{ko.agency.invitePending}</Badge>
                        <Button size="sm" variant="ghost" onClick={() => void revoke(invite.id)}>
                          {ko.common.delete}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
