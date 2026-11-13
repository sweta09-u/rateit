import type { Config } from 'tailwindcss'

/**
 * Rate It design system.
 *
 * Colours are semantic tokens (`bg`, `surface`, `fg`, `brand`…) wired to CSS
 * custom properties in globals.css. That is what makes one set of components
 * work in both the dark and the light variant of the orange system — the
 * component never names a hex value.
 */
const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        line: 'var(--line)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          soft: 'var(--brand-soft)',
          fg: 'var(--brand-fg)',
        },
        accent: 'var(--accent)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        '3xl': '22px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.24)',
        lift: '0 10px 28px rgba(0,0,0,0.36)',
        ring: '0 0 0 2px var(--bg), 0 0 0 4px var(--brand)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
}

export default config
