/**
 * Site configuration
 *
 * Central configuration for site-wide settings
 */

export const site = {
  /** Site name displayed in header and footer */
  name: 'Kubernetes Security',

  /** Site URL for Open Graph */
  url: 'https://kubernetes-security.cloud',

  /** Default meta description */
  description: 'Terminology, attack patterns, defensive strategies and tooling for Kubernetes — cross-linked against the MITRE ATT&CK container matrix.',

  /** Copyright holder name */
  copyright: 'Kubernetes Security',

  /** Open Graph image path (relative to public folder) */
  ogImage: '/og-image.png',

  /** Google Analytics Measurement ID (from environment variable, leave empty to disable) */
  googleAnalyticsId: import.meta.env.PUBLIC_GOOGLE_ANALYTICS_ID || '',

  /** Navigation links (order matters) */
  navigation: [
    { href: '/glossary', label: 'Glossary' },
    { href: '/topics', label: 'Topics' },
    { href: '/techniques', label: 'ATT&CK Map' },
    { href: '/tools', label: 'Tools' },
  ] as const,
} as const;

/**
 * Type for site configuration
 */
export type SiteConfig = typeof site;
