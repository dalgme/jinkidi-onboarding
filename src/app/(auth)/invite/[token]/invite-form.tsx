'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { MailCheck, ShieldAlert } from 'lucide-react'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ko } from '@/content/ko'
import { CONSENT_ITEMS } from '@/lib/auth/consent'
import type { ConsentKind } from '@/types/database'

import { acceptInvite } from './actions'

const CONSENT_LABEL: Record<ConsentKind, string> = {
  age14: ko.invite.consentAge14,
  terms: ko.invite.consentTerms,
  privacy: ko.invite.consentPrivacy,
  processing_delegation: ko.invite.consentDelegation,
}

const schema = z.object({
  name: z.string().trim().min(1, ko.invite.nameLabel),
  phone: z.string().trim().max(30).optional(),
})

type FormValues = z.infer<typeof schema>

export function InviteAcceptForm({
  token,
  email,
  projectName,
  agencyName,
}: {
  token: string
  email: string
  projectName: string
  agencyName: string
}) {
  const [consents, setConsents] = useState<ConsentKind[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', phone: '' } })

  const allChecked = consents.length === CONSENT_ITEMS.length

  function toggle(kind: ConsentKind, checked: boolean) {
    setConsents((prev) => (checked ? [...new Set([...prev, kind])] : prev.filter((k) => k !== kind)))
  }

  function toggleAll(checked: boolean) {
    setConsents(checked ? CONSENT_ITEMS.map((i) => i.kind) : [])
  }

  async function onSubmit(values: FormValues) {
    setError(null)
    const result = await acceptInvite({ token, name: values.name, phone: values.phone, consents })
    if (result.ok) {
      setSent(true)
    } else {
      setError(result.message)
    }
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <div className="mb-2 flex justify-center text-primary">
            <MailCheck className="h-8 w-8" aria-hidden />
          </div>
          <CardTitle className="text-center">{ko.auth.sentTitle}</CardTitle>
          <CardDescription className="text-center">{ko.invite.magicSent}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md bg-muted p-3 text-center text-sm font-medium">{email}</p>
          <Alert variant="info">
            <AlertDescription>{ko.auth.sentSpamNotice}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ko.invite.title}</CardTitle>
        <CardDescription>
          {projectName ? ko.invite.subtitle(projectName) : null} {agencyName ? `(${agencyName})` : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <p className="text-sm text-muted-foreground">{ko.invite.whatHappens}</p>

          <div className="space-y-2">
            <Label htmlFor="invite-email">{ko.auth.emailLabel}</Label>
            <Input id="invite-email" value={email} readOnly disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-name">
              {ko.invite.nameLabel} <span className="text-destructive">*</span>
            </Label>
            <Input id="invite-name" autoComplete="name" placeholder={ko.invite.namePlaceholder} {...form.register('name')} />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-phone">
              {ko.invite.phoneLabel} <span className="text-xs text-muted-foreground">({ko.common.optional})</span>
            </Label>
            <Input id="invite-phone" type="tel" inputMode="tel" autoComplete="tel" {...form.register('phone')} />
            <p className="text-xs text-muted-foreground">{ko.invite.phoneHelp}</p>
          </div>

          <Separator />

          <div className="space-y-3">
            <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-md bg-muted/60 px-3">
              <Checkbox checked={allChecked} onCheckedChange={(c) => toggleAll(c === true)} aria-label={ko.invite.agreeAll} />
              <span className="text-sm font-semibold">{ko.invite.agreeAll}</span>
            </label>

            {CONSENT_ITEMS.map((item) => (
              <div key={item.kind} className="flex min-h-touch items-center justify-between gap-3 px-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={consents.includes(item.kind)}
                    onCheckedChange={(c) => toggle(item.kind, c === true)}
                    aria-label={CONSENT_LABEL[item.kind]}
                  />
                  <span className="text-sm">
                    <span className="mr-1 text-destructive">({ko.common.required})</span>
                    {CONSENT_LABEL[item.kind]}
                  </span>
                </label>
                {item.href ? (
                  <Link
                    href={item.href}
                    target="_blank"
                    className="shrink-0 text-xs text-muted-foreground underline underline-offset-4"
                  >
                    {ko.invite.consentView}
                  </Link>
                ) : null}
              </div>
            ))}
          </div>

          <Alert variant="warning">
            <AlertDescription className="flex gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{ko.invite.sensitiveWarning}</span>
            </AlertDescription>
          </Alert>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" size="lg" disabled={!allChecked || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? ko.auth.sending : ko.invite.accept}
          </Button>
          {!allChecked ? <p className="text-center text-xs text-muted-foreground">{ko.invite.requiredNotice}</p> : null}
        </form>
      </CardContent>
    </Card>
  )
}
