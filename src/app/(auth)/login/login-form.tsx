'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ko } from '@/content/ko'
import { createClient } from '@/lib/supabase/client'

const RESEND_COOLDOWN_SECONDS = 60

const schema = z.object({
  email: z.string().email(ko.auth.invalidEmail),
})

type FormValues = z.infer<typeof schema>

export function LoginForm({ nextPath, initialError }: { nextPath: string | null; initialError: string | null }) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(initialError)
  const [cooldown, setCooldown] = useState(0)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function send(email: string) {
    setError(null)
    const supabase = createClient()
    const redirectTo = new URL('/auth/callback', window.location.origin)
    if (nextPath) redirectTo.searchParams.set('next', nextPath)

    const { error: sendError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo.toString() },
    })

    if (sendError) {
      setError(ko.auth.sendFailed)
      return
    }

    setSentTo(email)
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  if (sentTo) {
    return (
      <Card>
        <CardHeader>
          <div className="mb-2 flex justify-center text-primary">
            <MailCheck className="h-8 w-8" aria-hidden />
          </div>
          <CardTitle className="text-center">{ko.auth.sentTitle}</CardTitle>
          <CardDescription className="text-center">{ko.auth.sentBody}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md bg-muted p-3 text-center text-sm font-medium">{sentTo}</p>
          <Alert variant="info">
            <AlertDescription>{ko.auth.sentSpamNotice}</AlertDescription>
          </Alert>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            variant="outline"
            className="w-full"
            disabled={cooldown > 0 || form.formState.isSubmitting}
            onClick={() => void send(sentTo)}
          >
            {cooldown > 0 ? ko.auth.resendCooldown(cooldown) : ko.auth.resend}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ko.auth.loginTitle}</CardTitle>
        <CardDescription>{ko.auth.loginSubtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => send(values.email))}>
          <div className="space-y-2">
            <Label htmlFor="email">{ko.auth.emailLabel}</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              placeholder={ko.auth.emailPlaceholder}
              aria-invalid={form.formState.errors.email ? true : undefined}
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? ko.auth.sending : ko.auth.sendLink}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
