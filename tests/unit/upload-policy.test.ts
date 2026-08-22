import { describe, expect, it } from 'vitest'

import { buildStoragePath, checkUpload, MAX_FILE_SIZE_BYTES } from '@/lib/deliverables/upload-policy'

describe('checkUpload', () => {
  it('허용 형식은 통과한다', () => {
    expect(checkUpload({ name: '계약서.pdf', size: 1024, type: 'application/pdf' })).toBeNull()
    expect(checkUpload({ name: 'logo.png', size: 1024, type: 'image/png' })).toBeNull()
  })

  it('50MB를 넘으면 거부한다', () => {
    expect(checkUpload({ name: 'big.zip', size: MAX_FILE_SIZE_BYTES + 1, type: 'application/zip' })).toBe('too_large')
  })

  it('실행 파일은 확장자에서 거부된다', () => {
    expect(checkUpload({ name: 'malware.exe', size: 1024, type: 'application/x-msdownload' })).toBe('type_not_allowed')
    expect(checkUpload({ name: 'script.sh', size: 1024, type: 'text/x-shellscript' })).toBe('type_not_allowed')
    expect(checkUpload({ name: 'app.js', size: 1024, type: 'text/javascript' })).toBe('type_not_allowed')
  })

  it('확장자를 pdf로 위장해도 MIME이 다르면 거부한다 — 확장자만 검사하면 우회된다', () => {
    expect(checkUpload({ name: 'evil.pdf', size: 1024, type: 'text/html' })).toBe('type_not_allowed')
    expect(checkUpload({ name: 'evil.pdf', size: 1024, type: 'image/png' })).toBe('extension_mismatch')
  })

  it('한컴 파일처럼 MIME이 비어도 확장자가 허용 목록이면 받는다', () => {
    expect(checkUpload({ name: '제안서.hwp', size: 1024, type: '' })).toBeNull()
    expect(checkUpload({ name: '제안서.hwpx', size: 1024, type: 'application/octet-stream' })).toBeNull()
  })

  it('빈 파일은 거부한다', () => {
    expect(checkUpload({ name: 'empty.pdf', size: 0, type: 'application/pdf' })).toBe('empty')
  })
})

describe('buildStoragePath', () => {
  it('{agency}/{project}/{deliverable}/{filename} 형태다 — Storage 정책이 2번째 세그먼트를 본다', () => {
    const path = buildStoragePath('a-id', 'p-id', 'd-id', 'file.pdf')
    expect(path).toBe('a-id/p-id/d-id/file.pdf')
    expect(path.split('/')[1]).toBe('p-id')
  })

  it('한국어 파일명을 인코딩해 깨지지 않게 한다', () => {
    const path = buildStoragePath('a', 'p', 'd', '계약서 최종.pdf')
    expect(path).not.toContain('계약서')
    expect(decodeURIComponent(path.split('/')[3] ?? '')).toBe('계약서 최종.pdf')
  })
})
