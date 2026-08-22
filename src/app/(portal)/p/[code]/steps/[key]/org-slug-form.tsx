'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ko } from '@/content/ko'

import { saveOrgSlug } from './actions'

type OrgField = 'github_org' | 'vercel_team_slug' | 'supabase_org_slug' | 'primary_domain'

export function OrgSlugForm({
  projectCode,
  field,
  label,
  placeholder,
}: {
  projectCode: string
  field: OrgField
  label: string
  placeholder: string
}) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const result = await saveOrgSlug({ projectCode, field, value })
    setSaving(false)

    if (!result.ok) {
      setError(result.message ?? ko.common.unknownError)
      return
    }
    toast.success(ko.portal.orgSlugSaved)
    router.refresh()
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 py-5">
        <div className="space-y-2">
          <Label htmlFor={`org-${field}`} className="text-base">
            {ko.portal.orgSlugTitle}
          </Label>
          <p className="text-sm text-muted-foreground">{ko.portal.orgSlugHelp}</p>
          <Input
            id={`org-${field}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            aria-label={label}
            aria-invalid={error ? true : undefined}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <Button size="lg" className="w-full" disabled={saving || value.trim() === ''} onClick={() => void save()}>
          {saving ? ko.common.saving : ko.portal.orgSlugSave}
        </Button>
      </CardContent>
    </Card>
  )
}
