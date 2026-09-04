/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Space Grotesk',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'Space Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        app: {
          bg: 'rgb(var(--ks-bg, 255 255 255) / <alpha-value>)',
          surface: 'rgb(var(--ks-surface, 255 255 255) / <alpha-value>)',
          'surface-muted': 'rgb(var(--ks-surface-muted, 249 250 251) / <alpha-value>)',
          border: 'rgb(var(--ks-border, 229 231 235) / <alpha-value>)',
          'border-strong': 'rgb(var(--ks-border-strong, 209 213 219) / <alpha-value>)',
          text: {
            primary: 'rgb(var(--ks-text-primary, 17 24 39) / <alpha-value>)',
            secondary: 'rgb(var(--ks-text-secondary, 75 85 99) / <alpha-value>)',
            muted: 'rgb(var(--ks-text-muted, 107 114 128) / <alpha-value>)',
          },
          link: {
            DEFAULT: 'rgb(var(--ks-link, 59 130 246) / <alpha-value>)',
            hover: 'rgb(var(--ks-link-hover, 37 99 235) / <alpha-value>)',
          },
          code: {
            bg: 'rgb(var(--ks-inline-code-bg, 243 244 246) / <alpha-value>)',
            text: 'rgb(var(--ks-inline-code-text, 17 24 39) / <alpha-value>)',
            border: 'rgb(var(--ks-inline-code-border, 229 231 235) / <alpha-value>)',
          },
          pre: {
            bg: 'rgb(var(--ks-pre-bg, 17 24 39) / <alpha-value>)',
            text: 'rgb(var(--ks-pre-text, 243 244 246) / <alpha-value>)',
            border: 'rgb(var(--ks-pre-border, 31 41 55) / <alpha-value>)',
          },
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        offensive: {
          DEFAULT: 'rgb(var(--ks-offensive, 185 28 28) / <alpha-value>)',
          bg: 'rgb(var(--ks-offensive-bg, 254 226 226) / <alpha-value>)',
          border: 'rgb(var(--ks-offensive-border, 252 165 165) / <alpha-value>)',
        },
        defensive: {
          DEFAULT: 'rgb(var(--ks-defensive, 29 78 216) / <alpha-value>)',
          bg: 'rgb(var(--ks-defensive-bg, 219 234 254) / <alpha-value>)',
          border: 'rgb(var(--ks-defensive-border, 147 197 253) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [
    // Try to load typography plugin, fallback to empty if not available
    (function() {
      try {
        const typography = require('@tailwindcss/typography');
        return typography;
      } catch (e) {
        // Plugin not available, return null (will be filtered out)
        return null;
      }
    })(),
  ].filter(Boolean),
}
