import Link from 'next/link'
import { Building2, FileStack, LayoutGrid, Receipt } from 'lucide-react'

import { LogoutButton } from '@/components/common/logout-button'
import { ko } from '@/content/ko'
import { requireAgencyMember } from '@/lib/auth/guards'

/**
 * (agency) — 개발사 영역.
 * PC 우선, 정보 밀도 높은 레이아웃. 좌측 사이드바 + 상단바.
 */
export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const { member } = await requireAgencyMember()

  const nav = [
    { href: '/app', label: ko.nav.projects, icon: LayoutGrid },
    { href: '/app/clients', label: ko.nav.clients, icon: Building2 },
    { href: '/app/templates', label: ko.nav.templates, icon: FileStack, minRole: 'admin' as const },
    { href: '/app/rates', label: ko.nav.rates, icon: Receipt, minRole: 'owner' as const },
  ]

  const rank = { member: 0, admin: 1, owner: 2 }
  const visible = nav.filter((item) => !item.minRole || rank[member.role] >= rank[item.minRole])

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <Link href="/app" className="text-sm font-semibold tracking-tight">
            {ko.common.appName}
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {member.display_name ?? ''} · {member.role}
            </span>
            <LogoutButton />
          </div>
        </div>
        {/* 모바일에서는 사이드바 대신 상단 가로 스크롤 네비 */}
        <nav className="flex gap-1 overflow-x-auto border-t px-2 py-1.5 md:hidden">
          {visible.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-touch shrink-0 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r bg-background md:block">
          <nav className="sticky top-14 flex flex-col gap-0.5 p-3">
            {visible.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-touch items-center gap-2.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <item.icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
