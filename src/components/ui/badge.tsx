import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        pending: 'border-transparent bg-status-pending-bg text-status-pending-fg',
        progress: 'border-transparent bg-status-progress-bg text-status-progress-fg',
        done: 'border-transparent bg-status-done-bg text-status-done-fg',
        verified: 'border-transparent bg-status-verified-bg text-status-verified-fg',
        blocked: 'border-transparent bg-status-blocked-bg text-status-blocked-fg',
        skipped: 'border-transparent bg-status-skipped-bg text-status-skipped-fg',
        agency: 'border-transparent bg-side-agency-bg text-side-agency-fg',
        client: 'border-transparent bg-side-client-bg text-side-client-fg',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
