import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: [],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', lg: '2rem' },
      screens: { '2xl': '1400px' },
    },
    extend: {
      screens: {
        sm: '640px',
        md: '1024px',
        lg: '1280px',
      },
      fontFamily: {
        sans: ['var(--font-pretendard)', 'Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        status: {
          'pending-bg': 'hsl(var(--status-pending-bg))',
          'pending-fg': 'hsl(var(--status-pending-fg))',
          'progress-bg': 'hsl(var(--status-progress-bg))',
          'progress-fg': 'hsl(var(--status-progress-fg))',
          'done-bg': 'hsl(var(--status-done-bg))',
          'done-fg': 'hsl(var(--status-done-fg))',
          'verified-bg': 'hsl(var(--status-verified-bg))',
          'verified-fg': 'hsl(var(--status-verified-fg))',
          'blocked-bg': 'hsl(var(--status-blocked-bg))',
          'blocked-fg': 'hsl(var(--status-blocked-fg))',
          'skipped-bg': 'hsl(var(--status-skipped-bg))',
          'skipped-fg': 'hsl(var(--status-skipped-fg))',
        },
        side: {
          'agency-bg': 'hsl(var(--side-agency-bg))',
          'agency-fg': 'hsl(var(--side-agency-fg))',
          'client-bg': 'hsl(var(--side-client-bg))',
          'client-fg': 'hsl(var(--side-client-fg))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
