'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ko } from '@/content/ko'
import type { Project } from '@/types/database'

import { updateOrgField } from './actions'

type OrgField = 'github_org' | 'vercel_team_slug' | 'supabase_org_slug' | 'primary_domain'

const FIELDS: { field: OrgField; label: string }[] = [
  { field: 'github_org', label: ko.agency.githubOrgLabel },
  { field: 'vercel_team_slug', label: ko.agency.vercelTeamLabel },
  { field: 'supabase_org_slug', label: ko.agency.supabaseOrgLabel },
  { field: 'primary_domain', label: ko.agency.primaryDomainLabel },
]

export function OrgInfoCard({ project }: { project: Project }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{ko.agency.orgInfoTitle}</CardTitle>
        <CardDescription>{ko.agency.orgInfoHelp}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {FIELDS.map(({ field, label }) => (
          <EditableRow key={field} projectCode={project.code} field={field} label={label} initial={project[field]} />
        ))}
      </CardContent>
    </Card>
  )
}

function EditableRow({
  projectCode,
  field,
  label,
  initial,
}: {
  projectCode: string
  field: OrgField
  label: string
  initial: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initial ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const result = await updateOrgField({ projectCode, field, value })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.message ?? ko.common.unknownError)
      return
    }
    setValue(result.value ?? '')
    setEditing(false)
    toast.success(ko.common.saved)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <span className="w-40 shrink-0 text-sm text-muted-foreground">{label}</span>
        <Input value={value} onChange={(e) => setValue(e.target.value)} aria-label={label} autoFocus />
        <Button size="icon" variant="ghost" disabled={saving} onClick={() => void save()} aria-label={ko.common.save}>
          <Check aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setValue(initial ?? '')
            setEditing(false)
          }}
          aria-label={ko.common.cancel}
        >
          <X aria-hidden />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm">{value || ko.common.dash}</span>
        <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={`${label} ${ko.common.edit}`}>
          <Pencil aria-hidden />
        </Button>
      </div>
    </div>
  )
}
