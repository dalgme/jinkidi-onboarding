import { format, formatDistanceToNowStrict } from 'date-fns'
import { ko as koLocale } from 'date-fns/locale'

/** 2026년 8월 21일 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'yyyy년 M월 d일', { locale: koLocale })
}

/** 2026-08-21 14:32 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'yyyy-MM-dd HH:mm', { locale: koLocale })
}

/** 14:32 */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'HH:mm', { locale: koLocale })
}

/** 3일 전 */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return `${formatDistanceToNowStrict(date, { locale: koLocale })} 전`
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatKrw(amount: number): string {
  return `${Math.round(amount).toLocaleString('ko-KR')}원`
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)}${units[unit]}`
}
