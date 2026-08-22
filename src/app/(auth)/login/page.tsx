import type { Metadata } from 'next'

import { ko } from '@/content/ko'

import { LoginForm } from './login-form'

export const metadata: Metadata = { title: ko.auth.loginTitle }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams
  return <LoginForm nextPath={params.next ?? null} initialError={params.error ? ko.auth.callbackError : null} />
}
