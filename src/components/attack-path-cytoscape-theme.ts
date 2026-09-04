/**
 * Cytoscape theme tokens for attack path diagrams (light + dark).
 * Hex values align with step-type colors in src/utils/colors.ts.
 */

export type AttackStepType =
  | 'initial'
  | 'lateral'
  | 'privilege'
  | 'persistence'
  | 'exfiltration';

export interface StepTypeStyle {
  bg: string;
  border: string;
  text: string;
}

export interface CytoscapeTheme {
  canvas: string;
  edge: string;
  edgeWidth: number;
  defaultNode: StepTypeStyle;
  selected: { bg: string; border: string };
  hoverBorder: string;
  textOutline: string;
  stepTypes: Record<AttackStepType, StepTypeStyle>;
}

export const ATTACK_STEP_LEGEND: { type: AttackStepType; label: string }[] = [
  { type: 'initial', label: 'Initial access' },
  { type: 'lateral', label: 'Lateral movement' },
  { type: 'privilege', label: 'Privilege escalation' },
  { type: 'persistence', label: 'Persistence' },
  { type: 'exfiltration', label: 'Exfiltration' },
];

/** Left-border accents for step cards (matches diagram legend). */
export const STEP_TYPE_BORDER: Record<AttackStepType, { light: string; dark: string }> = {
  initial: { light: '#dc2626', dark: '#f87171' },
  lateral: { light: '#ca8a04', dark: '#facc15' },
  privilege: { light: '#7c3aed', dark: '#a78bfa' },
  persistence: { light: '#0891b2', dark: '#22d3ee' },
  exfiltration: { light: '#059669', dark: '#34d399' },
};

const lightStepTypes: Record<AttackStepType, StepTypeStyle> = {
  initial: { bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d' },
  lateral: { bg: '#fef9c3', border: '#ca8a04', text: '#713f12' },
  privilege: { bg: '#ede9fe', border: '#7c3aed', text: '#4c1d95' },
  persistence: { bg: '#cffafe', border: '#0891b2', text: '#164e63' },
  exfiltration: { bg: '#d1fae5', border: '#059669', text: '#064e3b' },
};

const darkStepTypes: Record<AttackStepType, StepTypeStyle> = {
  initial: { bg: '#450a0a', border: '#f87171', text: '#fecaca' },
  lateral: { bg: '#422006', border: '#facc15', text: '#fef08a' },
  privilege: { bg: '#2e1065', border: '#a78bfa', text: '#ddd6fe' },
  persistence: { bg: '#083344', border: '#22d3ee', text: '#a5f3fc' },
  exfiltration: { bg: '#052e16', border: '#34d399', text: '#a7f3d0' },
};

export const cytoscapeThemes: Record<'light' | 'dark', CytoscapeTheme> = {
  light: {
    canvas: '#ffffff',
    edge: '#6b7280',
    edgeWidth: 2.5,
    defaultNode: { bg: '#f3f4f6', border: '#9ca3af', text: '#111827' },
    selected: { bg: '#dbeafe', border: '#2563eb' },
    hoverBorder: '#2563eb',
    textOutline: '#ffffff',
    stepTypes: lightStepTypes,
  },
  dark: {
    canvas: '#18181b',
    edge: '#a1a1aa',
    edgeWidth: 2.5,
    defaultNode: { bg: '#27272a', border: '#71717a', text: '#f4f4f5' },
    selected: { bg: '#1e3a5f', border: '#60a5fa' },
    hoverBorder: '#60a5fa',
    textOutline: '#18181b',
    stepTypes: darkStepTypes,
  },
};

export function resolveThemeMode(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function getStepBorderColor(
  type: string | undefined,
  theme: CytoscapeTheme
): string {
  if (type && type in theme.stepTypes) {
    return theme.stepTypes[type as AttackStepType].border;
  }
  return theme.defaultNode.border;
}

/** Build Cytoscape stylesheet from theme tokens. */
export function buildCytoscapeStyles(theme: CytoscapeTheme): object[] {
  const baseNode = {
    label: 'data(label)',
    'min-width': 140,
    'min-height': 64,
    width: 'label',
    height: 'label',
    shape: 'roundrectangle',
    'background-color': theme.defaultNode.bg,
    'border-width': 2.5,
    'border-color': theme.defaultNode.border,
    color: theme.defaultNode.text,
    'text-valign': 'center',
    'text-halign': 'center',
    'text-wrap': 'wrap',
    'text-max-width': '160px',
    'font-size': 13,
    'font-weight': 600,
    'line-height': 1.25,
    padding: '12px 16px',
    'text-outline-width': 2,
    'text-outline-color': theme.textOutline,
    'text-outline-opacity': 1,
    'overlay-opacity': 0,
  };

  const stepTypeSelectors = (Object.keys(theme.stepTypes) as AttackStepType[]).map(
    (type) => ({
      selector: `node[type = "${type}"]`,
      style: {
        'background-color': theme.stepTypes[type].bg,
        'border-color': theme.stepTypes[type].border,
        color: theme.stepTypes[type].text,
      },
    })
  );

  return [
    { selector: 'node', style: baseNode },
    ...stepTypeSelectors,
    {
      selector: 'edge',
      style: {
        width: theme.edgeWidth,
        'line-color': theme.edge,
        'target-arrow-color': theme.edge,
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 1.4,
        opacity: 0.95,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 3.5,
        'border-color': theme.selected.border,
        'background-color': theme.selected.bg,
      },
    },
    {
      selector: 'node.highlighted',
      style: {
        'border-width': 4,
        'border-color': theme.selected.border,
        'background-color': theme.selected.bg,
      },
    },
    {
      selector: 'node.hover',
      style: {
        'border-width': 3.5,
        'border-color': theme.hoverBorder,
      },
    },
    {
      selector: 'node.active',
      style: {
        'border-width': 4,
        'border-color': theme.selected.border,
        'background-color': theme.selected.bg,
        opacity: 1,
      },
    },
    {
      selector: 'node.dimmed',
      style: { opacity: 0.28 },
    },
    {
      selector: 'edge.dimmed',
      style: { opacity: 0.15 },
    },
  ];
}
