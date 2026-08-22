import type { Metadata } from 'next'

import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/common/page-header'
import { ko } from '@/content/ko'
import { requireAgencyMember } from '@/lib/auth/guards'
import { formatDate } from '@/lib/utils/format'
import type { Client } from '@/types/database'

import { NewClientDialog } from './new-client-dialog'

export const metadata: Metadata = { title: ko.agency.clientsTitle }

export default async function ClientsPage() {
  const { supabase } = await requireAgencyMember()

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<Client[]>()

  const rows = clients ?? []

  return (
    <>
      <PageHeader title={ko.agency.clientsTitle} actions={<NewClientDialog />} />

      {rows.length === 0 ? (
        <EmptyState title={ko.agency.clientsEmpty} action={<NewClientDialog />} />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ko.agency.clientNameLabel}</TableHead>
                <TableHead>{ko.agency.clientContactNameLabel}</TableHead>
                <TableHead>{ko.agency.clientContactEmailLabel}</TableHead>
                <TableHead>{ko.agency.clientContactPhoneLabel}</TableHead>
                <TableHead>{ko.common.createdAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-sm">{client.contact_name ?? ko.common.dash}</TableCell>
                  <TableCell className="text-sm">{client.contact_email ?? ko.common.dash}</TableCell>
                  <TableCell className="text-sm">{client.contact_phone ?? ko.common.dash}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(client.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  )
}
