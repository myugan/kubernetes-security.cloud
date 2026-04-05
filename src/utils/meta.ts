/**
 * Normalize text for meta tags (Open Graph, Twitter, HTML description).
 * Collapses whitespace and truncates so previews stay readable in link unfurlers.
 */
export function toMetaDescription(raw: string, maxLength = 300): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length <= maxLength) return s;
  const cut = s.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > maxLength * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${base.trim()}…`;
}
