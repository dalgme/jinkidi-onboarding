import type { MetadataRoute } from 'next'

/**
 * 전 구간 비공개 내부 도구다 (설계 문서 5.4).
 * 검색엔진을 전면 차단하되, 약관·처리방침만 예외로 허용한다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
        allow: ['/terms', '/privacy'],
      },
    ],
  }
}
