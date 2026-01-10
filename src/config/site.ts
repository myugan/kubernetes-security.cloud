/**
 * Site configuration
 *
 * Central configuration for site-wide settings
 */

export const site = {
  /** Site name displayed in header and footer */
  name: 'Kubernetes Security',

  /** Default meta description */
  description: 'A comprehensive reference for Kubernetes security concepts, topics, and best practices.',

  /** Copyright holder name */
  copyright: 'Kubernetes Security',

  /** Google Analytics Measurement ID (from environment variable, leave empty to disable) */
  googleAnalyticsId: import.meta.env.PUBLIC_GOOGLE_ANALYTICS_ID || '',

  /** Navigation links (order matters) */
  navigation: [
    { href: '/glossary', label: 'Glossary' },
    { href: '/topics', label: 'Topics' },
    { href: '/tools', label: 'Tools' },
    { href: '/', label: 'About' },
  ] as const,
} as const;

/**
 * Type for site configuration
 */
export type SiteConfig = typeof site;
