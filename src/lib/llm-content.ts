/**
 * LLM index generation from Astro content collections.
 * Add a new collection in content/config.ts, then register a section builder here
 * (or rely on the generic fallback) so llms.txt updates on the next build.
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import { features, type FeatureFlags } from '../config/features';
import { toAbsoluteUrl, getSiteUrl } from './site-url';

const ATTACK_STEP_TYPES = ['initial', 'lateral', 'privilege', 'persistence', 'exfiltration'] as const;

/** Collections included in the LLM index (extend when adding new content types). */
const LLM_COLLECTIONS = ['topics', 'glossary', 'attack-paths'] as const;
type LlmCollectionName = (typeof LLM_COLLECTIONS)[number];

const FEATURE_GATED: Partial<Record<LlmCollectionName, keyof FeatureFlags>> = {
  'attack-paths': 'attackPaths',
};

export interface LlmContentSnapshot {
  generatedAt: string;
  site: string;
  topics: CollectionEntry<'topics'>[];
  glossary: CollectionEntry<'glossary'>[];
  attackPaths: CollectionEntry<'attack-paths'>[];
}

export function oneLine(text: string, max = 220): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}

function toList(value: string | string[]): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  return [value.trim()].filter(Boolean);
}

function formatK8sVersion(value: string | string[]): string {
  return Array.isArray(value) ? value.join(', ') : value;
}

function isCollectionEnabled(name: LlmCollectionName): boolean {
  const flag = FEATURE_GATED[name];
  return !flag || features[flag];
}

/** Load all content used by LLM endpoints (single source of truth). */
export async function loadLlmContent(): Promise<LlmContentSnapshot> {
  const [topics, glossary, attackPaths] = await Promise.all([
    getCollection('topics'),
    getCollection('glossary'),
    isCollectionEnabled('attack-paths') ? getCollection('attack-paths') : Promise.resolve([]),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    site: getSiteUrl(),
    topics,
    glossary,
    attackPaths,
  };
}

/** Plain-text llms.txt body. Regenerated on every build and dev request. */
export function buildLlmsTxt(snapshot: LlmContentSnapshot): string {
  const { site, generatedAt, topics, glossary, attackPaths } = snapshot;

  const sortedTopics = [...topics].sort((a, b) => a.data.title.localeCompare(b.data.title));
  const sortedGlossary = [...glossary].sort((a, b) => a.data.title.localeCompare(b.data.title));
  const sortedAttackPaths = [...attackPaths].sort((a, b) => a.data.title.localeCompare(b.data.title));

  const offensiveTopics = sortedTopics.filter((t) => t.data.category === 'offensive');
  const defensiveTopics = sortedTopics.filter((t) => t.data.category === 'defensive');
  const fundamentalTopics = sortedTopics.filter((t) => t.data.category === 'fundamental');
  const offensivePhases = [
    ...new Set(
      offensiveTopics
        .map((t) => t.data.phase ?? t.data.offensiveType)
        .filter((phase): phase is string => Boolean(phase))
    ),
  ].sort();

  const lines: string[] = [
    '# kubernetes-security.cloud',
    '',
    '> Kubernetes security reference: offensive/defensive topics, glossary, MITRE ATT&CK technique index, and interactive attack-path maps with step-by-step breakdowns.',
    '',
    '## Generated',
    `- generatedAt: ${generatedAt}`,
    `- source: astro content collections (${LLM_COLLECTIONS.join(', ')})`,
    '',
    '## LLM usage notes',
    '- This file is generated automatically on deploy; do not edit by hand.',
    '- Prefer `topics.json` for structured topic metadata, phases, MITRE IDs, and markdown URLs.',
    ...(features.attackPaths
      ? [
          '- Prefer `attack-paths.json` for attack path graphs: steps, types, connections, and per-step MITRE techniques.',
          '- Attack path HTML pages include an interactive diagram; step types are color-coded: initial, lateral, privilege, persistence, exfiltration.',
          '- Step `connections` in YAML define diagram edges; if omitted, steps chain sequentially.',
        ]
      : []),
    '- For offensive topics, filter `category=offensive` then group/order by `phase`.',
    '- Use `/topics/<topic-slug>.md` for full markdown plus extracted action headings and commands.',
    '- `phase` is the canonical offensive classification field on topics.',
    '- Glossary entries are HTML only (no `.md` mirror); fetch the page or use the sitemap.',
    '- `/techniques` lists MITRE ATT&CK techniques mapped to offensive topics on this site.',
    '',
    '## Important URLs',
    `- Site home: ${toAbsoluteUrl('/', site)}`,
    `- Topics overview: ${toAbsoluteUrl('/topics', site)}`,
    `- Glossary overview: ${toAbsoluteUrl('/glossary', site)}`,
    `- MITRE techniques index: ${toAbsoluteUrl('/techniques', site)}`,
    `- Security tools index: ${toAbsoluteUrl('/tools', site)}`,
    `- Machine-readable topic index (JSON): ${toAbsoluteUrl('/topics.json', site)}`,
    `- Raw markdown topic endpoint pattern: ${toAbsoluteUrl('/topics/<topic-slug>.md', site)}`,
    `- Sitemap: ${toAbsoluteUrl('/sitemap-index.xml', site)}`,
    `- LLM index (this file): ${toAbsoluteUrl('/llms.txt', site)}`,
    ...(features.attackPaths
      ? [
          `- Attack paths overview: ${toAbsoluteUrl('/attack-paths', site)}`,
          `- Machine-readable attack path index (JSON): ${toAbsoluteUrl('/attack-paths.json', site)}`,
        ]
      : []),
    '',
    '## Content totals',
    `- Topics: ${sortedTopics.length} (offensive: ${offensiveTopics.length}, defensive: ${defensiveTopics.length}, fundamental: ${fundamentalTopics.length})`,
    `- Glossary entries: ${sortedGlossary.length}`,
    ...(features.attackPaths ? [`- Attack paths: ${sortedAttackPaths.length}`] : []),
    '',
    '## Offensive phase index (topics)',
    ...offensivePhases.map((phase) => {
      const count = offensiveTopics.filter(
        (t) => (t.data.phase ?? t.data.offensiveType) === phase
      ).length;
      return `- ${phase}: ${count} topic(s)`;
    }),
    '',
    '## Topic pages',
    ...sortedTopics.map((topic) => {
      const phaseValue = topic.data.phase ?? topic.data.offensiveType ?? 'n/a';
      const mitre = (topic.data.mitreTechniques ?? []).join(', ') || 'none';
      return `- ${toAbsoluteUrl(`/topics/${topic.slug}`, site)} | md: ${toAbsoluteUrl(`/topics/${topic.slug}.md`, site)} | category: ${topic.data.category} | phase: ${phaseValue} | mitre: ${mitre} | ${topic.data.title} | ${oneLine(topic.data.description)}`;
    }),
    '',
    '## Glossary pages',
    ...sortedGlossary.map((entry) => {
      const mitre = (entry.data.mitreTechniques ?? []).join(', ') || 'none';
      return `- ${toAbsoluteUrl(`/glossary/${entry.slug}`, site)} | category: ${entry.data.category} | mitre: ${mitre} | ${entry.data.title} | ${oneLine(entry.data.description)}`;
    }),
  ];

  if (features.attackPaths && sortedAttackPaths.length > 0) {
    lines.push(
      '',
      '## Attack path step types',
      ...ATTACK_STEP_TYPES.map(
        (type) =>
          `- ${type}: ${type === 'initial' ? 'entry / first compromise' : type === 'lateral' ? 'discovery, movement, credential access' : type === 'privilege' ? 'escalation' : type === 'persistence' ? 'maintain access' : 'data or secret theft'}`
      ),
      '',
      '## Attack path summaries',
      ...sortedAttackPaths.map((path) => {
        const mitre = (path.data.mitreTechniques ?? []).join(', ') || 'none';
        const k8s = formatK8sVersion(path.data.kubernetesVersion);
        return `- ${toAbsoluteUrl(`/attack-paths/${path.id}`, site)} | category: ${path.data.category} | k8s: ${k8s} | steps: ${path.data.steps.length} | mitre: ${mitre} | ${path.data.title} | ${oneLine(path.data.description)}`;
      }),
      '',
      '## Attack path steps (detailed)'
    );

    for (const path of sortedAttackPaths) {
      lines.push('', `### ${path.data.title} (${path.id})`, '');
      for (const [index, step] of path.data.steps.entries()) {
        const mitre = step.mitreTechnique ?? 'none';
        const next = step.connections?.length
          ? step.connections.join(', ')
          : index < path.data.steps.length - 1
            ? path.data.steps[index + 1].id
            : 'end';
        const hasCmd = step.command ? 'yes' : 'no';
        lines.push(
          `- step ${index + 1} | id: ${step.id} | type: ${step.type} | mitre: ${mitre} | command: ${hasCmd} | next: ${next} | ${step.title} | ${oneLine(step.description, 180)}`
        );
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function buildTopicsJsonPayload(snapshot: LlmContentSnapshot) {
  const { site, generatedAt, topics } = snapshot;
  const sortedTopics = [...topics].sort((a, b) => a.data.title.localeCompare(b.data.title));
  const offensiveTopics = sortedTopics.filter((t) => t.data.category === 'offensive');
  const offensivePhases = [
    ...new Set(
      offensiveTopics
        .map((t) => t.data.phase ?? t.data.offensiveType)
        .filter((phase): phase is string => Boolean(phase))
    ),
  ].sort();

  return {
    site,
    generatedAt,
    totalTopics: sortedTopics.length,
    llmGuide: {
      primaryFilterOrder: ['category', 'phase', 'title'],
      offensivePhaseField: 'phase',
      offensivePhases,
    },
    offensiveTopicsByPhase: offensivePhases.map((phase) => ({
      phase,
      total: offensiveTopics.filter((t) => (t.data.phase ?? t.data.offensiveType) === phase).length,
      slugs: offensiveTopics
        .filter((t) => (t.data.phase ?? t.data.offensiveType) === phase)
        .map((t) => t.slug),
    })),
    topics: sortedTopics.map((topic) => ({
      slug: topic.slug,
      url: toAbsoluteUrl(`/topics/${topic.slug}`, site),
      markdownUrl: toAbsoluteUrl(`/topics/${topic.slug}.md`, site),
      title: topic.data.title,
      description: topic.data.description,
      category: topic.data.category,
      phase: topic.data.phase ?? topic.data.offensiveType ?? null,
      offensiveType: topic.data.phase ?? topic.data.offensiveType ?? null,
      impact: toList(topic.data.impact),
      mitigation: toList(topic.data.mitigation),
      tools: topic.data.tools ?? [],
      mitreTechniques: topic.data.mitreTechniques ?? [],
      kubernetesVersion: topic.data.kubernetesVersion ?? null,
      createdAt: topic.data.createdAt ? topic.data.createdAt.toISOString() : null,
      llmActionFocus: {
        category: topic.data.category,
        phase: topic.data.phase ?? topic.data.offensiveType ?? null,
        objective: topic.data.description,
      },
    })),
  };
}

export function buildAttackPathsJsonPayload(snapshot: LlmContentSnapshot) {
  const { site, generatedAt, attackPaths } = snapshot;

  if (!features.attackPaths) {
    return {
      site,
      generatedAt,
      available: false,
      message: 'Attack paths feature is disabled on this deployment.',
      attackPaths: [],
    };
  }

  const sorted = [...attackPaths].sort((a, b) => a.data.title.localeCompare(b.data.title));

  return {
    site,
    generatedAt,
    available: true,
    totalAttackPaths: sorted.length,
    llmGuide: {
      stepTypes: [...ATTACK_STEP_TYPES],
      stepTypeDescriptions: {
        initial: 'Entry point / first compromise',
        lateral: 'Discovery, movement, or credential access within the cluster',
        privilege: 'Escalation to higher privileges',
        persistence: 'Maintaining access after initial objectives',
        exfiltration: 'Stealing data or secrets',
      },
      graphNotes:
        'Steps link via `connections` when set; otherwise they chain sequentially to the next step.',
      htmlUrlPattern: '/attack-paths/<path-id>',
    },
    attackPaths: sorted.map((path) => ({
      id: path.id,
      url: toAbsoluteUrl(`/attack-paths/${path.id}`, site),
      title: path.data.title,
      description: path.data.description,
      category: path.data.category,
      kubernetesVersion: path.data.kubernetesVersion,
      mitreTechniques: path.data.mitreTechniques ?? [],
      stepCount: path.data.steps.length,
      steps: path.data.steps.map((step, index) => ({
        id: step.id,
        stepNumber: index + 1,
        title: step.title,
        type: step.type,
        description: step.description.replace(/\s+/g, ' ').trim(),
        mitreTechnique: step.mitreTechnique ?? null,
        connections:
          step.connections ??
          (index < path.data.steps.length - 1 ? [path.data.steps[index + 1].id] : []),
        hasCommand: Boolean(step.command),
        commandLineCount: step.command
          ? (Array.isArray(step.command) ? step.command : step.command.split('\n')).filter(
              (l) => l.trim() && !l.trim().startsWith('#')
            ).length
          : 0,
      })),
    })),
  };
}

export const LLM_INDEX_FILES = ['llms.txt', 'topics.json', 'attack-paths.json'] as const;

export const LLM_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300',
} as const;
