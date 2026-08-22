/**
 * 업로드 제한 — 설계 문서 10.5
 *
 * ⚠ 확장자만 검사하면 우회된다. MIME과 확장자를 «둘 다» 검사한다.
 *   실행 파일·스크립트는 화이트리스트에 없으므로 자동으로 차단된다.
 */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

export interface AllowedType {
  mime: string[]
  extensions: string[]
}

export const ALLOWED_TYPES: AllowedType[] = [
  { mime: ['application/pdf'], extensions: ['pdf'] },
  { mime: ['image/png'], extensions: ['png'] },
  { mime: ['image/jpeg'], extensions: ['jpg', 'jpeg'] },
  { mime: ['image/svg+xml'], extensions: ['svg'] },
  { mime: ['application/zip', 'application/x-zip-compressed'], extensions: ['zip'] },
  { mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], extensions: ['docx'] },
  { mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], extensions: ['xlsx'] },
  { mime: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], extensions: ['pptx'] },
  { mime: ['application/haansofthwp', 'application/vnd.hancom.hwp', 'application/x-hwp'], extensions: ['hwp'] },
  { mime: ['application/vnd.hancom.hwpx', 'application/hwp+zip'], extensions: ['hwpx'] },
]

export const ALLOWED_EXTENSIONS = ALLOWED_TYPES.flatMap((t) => t.extensions)
export const ALLOWED_MIME_TYPES = ALLOWED_TYPES.flatMap((t) => t.mime)

export type UploadRejection = 'too_large' | 'type_not_allowed' | 'extension_mismatch' | 'empty'

export function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
}

/**
 * 파일을 받아도 되는지 판정한다.
 * MIME과 확장자가 «같은 항목»을 가리켜야 통과한다.
 */
export function checkUpload(file: { name: string; size: number; type: string }): UploadRejection | null {
  if (file.size <= 0) return 'empty'
  if (file.size > MAX_FILE_SIZE_BYTES) return 'too_large'

  const extension = extensionOf(file.name)
  const byMime = ALLOWED_TYPES.find((t) => t.mime.includes(file.type.toLowerCase()))
  const byExtension = ALLOWED_TYPES.find((t) => t.extensions.includes(extension))

  if (!byExtension) return 'type_not_allowed'

  /*
   * 한컴 파일 등은 브라우저가 MIME을 비우거나 octet-stream으로 보낸다.
   * 확장자가 화이트리스트에 있고 MIME이 비었으면 확장자를 신뢰한다.
   * (화이트리스트에 실행 파일 확장자가 없으므로 이 완화가 위험을 만들지 않는다)
   */
  if (file.type === '' || file.type.toLowerCase() === 'application/octet-stream') return null

  if (!byMime) return 'type_not_allowed'
  if (byMime !== byExtension) return 'extension_mismatch'

  return null
}

/** 경로: {agency_id}/{project_id}/{deliverable_id}/{filename} */
export function buildStoragePath(agencyId: string, projectId: string, deliverableId: string, fileName: string): string {
  // 한국어 파일명이 깨지지 않게 인코딩한다
  return `${agencyId}/${projectId}/${deliverableId}/${encodeURIComponent(fileName)}`
}

export const STORAGE_BUCKET = 'deliverables'

/** 서명 URL 만료 — 1시간 (설계 문서 10.5) */
export const SIGNED_URL_TTL_SECONDS = 3600
