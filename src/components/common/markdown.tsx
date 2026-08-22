import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

import { cn } from '@/lib/utils/cn'

/**
 * 마크다운 렌더러.
 *
 * CLAUDE.md §9 — rehype-sanitize를 반드시 거친다. dangerouslySetInnerHTML 금지.
 * 코멘트는 사용자 입력이고, 단계 안내문도 개발사가 화면에서 편집하므로
 * 두 경로 모두 sanitize 대상이다.
 */
export interface MarkdownProps {
  children: string
  variant?: 'portal' | 'comment'
  className?: string
}

export function Markdown({ children, variant = 'portal', className }: MarkdownProps) {
  return (
    <div className={cn(variant === 'portal' ? 'prose-portal' : 'prose-comment', className)}>
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
