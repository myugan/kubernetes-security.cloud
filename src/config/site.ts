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
  description: 'A comprehensive reference for Kubernetes security concepts, topics, and best practices.',

  /** Copyright holder name */
  copyright: 'Kubernetes Security',

  /** Open Graph image path (relative to public folder) */
  ogImage: '/og-image.png',

  /** Timezone used to decide whether a topic `createdAt` date is live */
  publishTimeZone: 'Asia/Bangkok',

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
