-- ─────────────────────────────────────────────────────────────
-- Storage — deliverables 버킷 (private)
-- 설계 문서 10.5
--
-- public 버킷은 URL만 알면 누구나 받을 수 있다. 계약서가 올라가는 순간 사고다.
-- 다운로드는 항상 서버에서 createSignedUrl(3600)으로 발급한다.
-- 경로: {agency_id}/{project_id}/{deliverable_id}/{filename}
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deliverables',
  'deliverables',
  false,
  52428800, -- 50MB
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/haansofthwp',
    'application/vnd.hancom.hwp',
    'application/vnd.hancom.hwpx'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 경로 2번째 세그먼트가 project_id다: {agency_id}/{project_id}/...
create policy deliverables_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[2]::uuid in (select public.my_project_ids())
  );

create policy deliverables_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[1]::uuid in (select public.my_agency_ids())
    and (storage.foldername(name))[2]::uuid in (select public.my_agency_project_ids())
  );

create policy deliverables_objects_update on storage.objects for update to authenticated
  using (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[2]::uuid in (select public.my_agency_project_ids())
  )
  with check (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[2]::uuid in (select public.my_agency_project_ids())
  );

create policy deliverables_objects_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[2]::uuid in (select public.my_agency_project_ids())
  );
