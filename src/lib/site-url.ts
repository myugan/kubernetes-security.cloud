/** Canonical site origin (from astro.config `site`, overridable at build time). */
export function getSiteUrl(): string {
  const raw =
    (typeof import.meta.env.SITE === 'string' && import.meta.env.SITE) ||
    'https://kubernetes-security.cloud';
  const trimmed = raw.trim().replace(/\/$/, '');
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export function toAbsoluteUrl(path: string, site = getSiteUrl()): string {
  return `${site}${path.startsWith('/') ? path : `/${path}`}`;
}
