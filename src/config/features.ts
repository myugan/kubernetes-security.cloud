/**
 * Feature flags configuration
 *
 * Use these flags to enable/disable features across the website.
 * Set to `true` to enable, `false` to disable.
 *
 * @example
 * ```ts
 * import { features } from '../config/features';
 *
 * if (features.attackPaths) {
 *   // Show attack paths content
 * }
 * ```
 */

export const features = {
  /**
   * Attack Paths feature
   * Shows the Attack Paths section in navigation and allows access to attack path pages
   */
  attackPaths: false,

  /**
   * Search functionality
   * Enables the search bar on supported pages
   */
  search: true,
} as const;

/**
 * Type for feature flags
 */
export type FeatureFlags = typeof features;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return features[feature];
}
