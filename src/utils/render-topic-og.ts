import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { TOPIC_OG_HEIGHT, TOPIC_OG_WIDTH } from '../config/topic-og';

const OG_WIDTH = TOPIC_OG_WIDTH;
const OG_HEIGHT = TOPIC_OG_HEIGHT;

const SANS = 'Space Grotesk';
const MONO = 'Space Mono';

type SatoriNode = {
  type: string;
  props: {
    style?: Record<string, unknown>;
    children?: SatoriNode | SatoriNode[] | string | number | (SatoriNode | string | number | null | undefined)[];
    [key: string]: unknown;
  };
};

type OgCategory = 'offensive' | 'defensive' | 'fundamental';

type OgPalette = {
  canvas: string;
  gradientFrom: string;
  gradientTo: string;
  accent: string;
};

const palettes: Record<OgCategory, OgPalette> = {
  offensive: {
    canvas: '#1c0d0d',
    gradientFrom: '#2a1113',
    gradientTo: '#120809',
    accent: '#e0574a',
  },
  defensive: {
    canvas: '#0d1b33',
    gradientFrom: '#122745',
    gradientTo: '#091426',
    accent: '#4d9bf0',
  },
  fundamental: {
    canvas: '#121316',
    gradientFrom: '#1c1e24',
    gradientTo: '#0c0d10',
    accent: '#a1a1aa',
  },
};

type OgFontEntry = { name: string; data: Buffer; weight: number; style: 'normal' };

let ogFonts: OgFontEntry[] | null = null;

function getOgFonts(): OgFontEntry[] {
  if (ogFonts) return ogFonts;

  const grotesk = join(process.cwd(), 'node_modules/@fontsource/space-grotesk/files');
  const mono = join(process.cwd(), 'node_modules/@fontsource/space-mono/files');
  ogFonts = [
    { name: SANS, data: readFileSync(join(grotesk, 'space-grotesk-latin-400-normal.woff')), weight: 400, style: 'normal' },
    { name: SANS, data: readFileSync(join(grotesk, 'space-grotesk-latin-500-normal.woff')), weight: 500, style: 'normal' },
    { name: SANS, data: readFileSync(join(grotesk, 'space-grotesk-latin-600-normal.woff')), weight: 600, style: 'normal' },
    { name: SANS, data: readFileSync(join(grotesk, 'space-grotesk-latin-700-normal.woff')), weight: 700, style: 'normal' },
    { name: MONO, data: readFileSync(join(mono, 'space-mono-latin-400-normal.woff')), weight: 400, style: 'normal' },
  ];
  return ogFonts;
}

function normalizeCategory(category: string): OgCategory {
  if (category === 'offensive' || category === 'defensive' || category === 'fundamental') {
    return category;
  }
  return 'fundamental';
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

function formatTactic(phase?: string | null): string | null {
  if (!phase) return null;
  return phase.replace(/-/g, ' ').toUpperCase();
}

function el(
  type: string,
  style: Record<string, unknown>,
  children?: SatoriNode['props']['children'],
  extra: Record<string, unknown> = {},
): SatoriNode {
  return { type, props: { style, children, ...extra } };
}

function buildTree(input: {
  title: string;
  description: string;
  category: string;
  phase?: string | null;
}): SatoriNode {
  const cat = normalizeCategory(input.category);
  const palette = palettes[cat];
  const tactic = cat === 'offensive' ? formatTactic(input.phase) : null;
  const titleSize = input.title.trim().length > 36 ? 74 : 82;
  const grid = [
    `repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 64px)`,
    `repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 64px)`,
  ].join(', ');

  return el(
    'div',
    {
      display: 'flex',
      width: `${OG_WIDTH}px`,
      height: `${OG_HEIGHT}px`,
      backgroundColor: palette.canvas,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: SANS,
    },
    [
      el('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${OG_WIDTH}px`,
        height: `${OG_HEIGHT}px`,
        backgroundImage: `linear-gradient(160deg, ${palette.gradientFrom} 0%, ${palette.canvas} 52%, ${palette.gradientTo} 100%)`,
      }),
      el('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${OG_WIDTH}px`,
        height: `${OG_HEIGHT}px`,
        backgroundImage: grid,
      }),
      el('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${OG_WIDTH}px`,
        height: 5,
        backgroundColor: palette.accent,
      }),
      el('div', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 5,
        height: `${OG_HEIGHT}px`,
        backgroundColor: palette.accent,
        opacity: 0.35,
      }),
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: `${OG_WIDTH}px`,
          height: `${OG_HEIGHT}px`,
          padding: '52px 56px 44px',
          position: 'relative',
        },
        [
          el(
            'div',
            {
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: 1,
              gap: 22,
              maxWidth: 1000,
            },
            [
              el(
                'div',
                {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: tactic ? 14 : 0,
                },
                [
                  ...(tactic
                    ? [
                        el(
                          'div',
                          {
                            color: palette.accent,
                            fontSize: 13,
                            fontWeight: 400,
                            letterSpacing: 1.56,
                            fontFamily: MONO,
                          },
                          tactic,
                        ),
                      ]
                    : []),
                  el(
                    'div',
                    {
                      color: '#ffffff',
                      fontSize: titleSize,
                      fontWeight: 600,
                      lineHeight: 1.02,
                      letterSpacing: titleSize * -0.04,
                      fontFamily: SANS,
                    },
                    truncate(input.title, 90),
                  ),
                ],
              ),
              el(
                'div',
                {
                  color: '#aab4c1',
                  fontSize: 23,
                  lineHeight: 1.45,
                  fontWeight: 400,
                  fontFamily: SANS,
                  maxWidth: 920,
                },
                truncate(input.description, 280),
              ),
            ],
          ),
          el(
            'div',
            {
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'flex-end',
              alignItems: 'flex-end',
              borderTop: '1px solid rgba(255,255,255,0.12)',
              paddingTop: 22,
            },
            [
              el(
                'div',
                {
                  color: '#6f7b8a',
                  fontSize: 16,
                  fontWeight: 400,
                  fontFamily: MONO,
                },
                'kubernetes-security.cloud',
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

export async function renderTopicOgPng(input: {
  title: string;
  description: string;
  category: string;
  phase?: string | null;
}): Promise<Uint8Array> {
  const fonts = getOgFonts();
  const svg = await satori(buildTree(input) as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight,
      style: f.style,
    })),
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}
