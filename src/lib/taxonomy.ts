/** Shared labels, grouping, and formatting for the redesign. */

export const GLOSSARY_TYPE_ORDER = ['component', 'resource', 'attack', 'security'] as const;

export const GLOSSARY_TYPE_LABEL: Record<string, string> = {
  component: 'COMPONENT',
  resource: 'RESOURCE',
  attack: 'ATTACK',
  security: 'SECURITY',
  defense: 'SECURITY',
  concept: 'CONCEPT',
};

export const GLOSSARY_TYPE_FACET_LABEL: Record<string, string> = {
  component: 'Component',
  resource: 'Resource',
  attack: 'Attack',
  security: 'Security',
  defense: 'Security',
  concept: 'Concept',
};

/** Canonical type used for color tokens (defense → security). */
export function glossaryTypeKey(category: string): string {
  const key = category.toLowerCase();
  if (key === 'defense') return 'security';
  return key;
}

export function glossaryTypeLabel(category: string): string {
  return GLOSSARY_TYPE_LABEL[category.toLowerCase()] ?? category.toUpperCase();
}

export function formatPhase(phase?: string): string {
  if (!phase) return '';
  return phase
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatPhaseUpper(phase?: string): string {
  return formatPhase(phase).toUpperCase();
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Kill-chain columns used on the landing page and as the ATT&CK map spine. */
export const LANDING_TACTICS = [
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Impact',
] as const;

/** Stroke paths for MITRE tactics / offensive phases (existing site icon set). */
export const TACTIC_ICON_PATHS: Record<string, string> = {
  reconnaissance: 'M15 15l5 5M10.5 16a5.5 5.5 0 110-11 5.5 5.5 0 010 11z',
  discovery: 'M15 15l5 5M10.5 16a5.5 5.5 0 110-11 5.5 5.5 0 010 11z',
  execution: 'M5 12h10M12 5l7 7-7 7',
  'lateral-movement': 'M8 16l8-8M8 8h8v8',
  'credential-access': 'M7 11a5 5 0 019.9-1M8 11h8v8H8z',
  'privilege-escalation': 'M12 19V5m0 0l-4 4m4-4l4 4',
  persistence: 'M12 8v8m-4-4h8M5 12a7 7 0 1114 0 7 7 0 01-14 0z',
  'defense-evasion': 'M3 3l18 18M10.7 5.1A9 9 0 0121 12M3 12a9 9 0 003.5 7.1',
  exfiltration: 'M7 17l10-10M7 7h10v10',
  'initial-access': 'M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3',
  impact: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  collection: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  'command-and-control': 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01M5.05 13.343a10 10 0 0113.9 0M1.394 9.22A15 15 0 0122.606 9.22',
};

export function tacticKey(name?: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function tacticIconPath(name?: string): string {
  const key = tacticKey(name);
  return TACTIC_ICON_PATHS[key] ?? 'M12 5v14M5 12h14';
}

export type SearchItem = {
  href: string;
  title: string;
  group: 'Glossary' | 'Topics';
  meta: string;
  haystack: string;
};
