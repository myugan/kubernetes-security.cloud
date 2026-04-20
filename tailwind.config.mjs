/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'DM Sans',
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
          'JetBrains Mono',
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
            DEFAULT: 'rgb(var(--ks-link, 2 132 199) / <alpha-value>)',
            hover: 'rgb(var(--ks-link-hover, 3 105 161) / <alpha-value>)',
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
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
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
