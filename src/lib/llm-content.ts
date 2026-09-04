/**
 * LLM index generation from Astro content collections.
 * Add a new collection in content/config.ts, then register a section builder here
 * (or rely on the generic fallback) so llms.txt updates on the next build.
 */

import { getCollection, type CollectionEntry } from 'astro:content';
import { features, type FeatureFlags } from '../config/features';
import { getAllMitreTechniques } from '../data/mitre-attack';
import { getAllTools, getToolTypes, tools } from '../data/tools';
import { glossaryToMarkdown, topicToMarkdown } from './llm-markdown';
import { site as siteConfig } from '../config/site';
import { toAbsoluteUrl, getSiteUrl } from './site-url';
import { getPublishedTopics } from '../utils/published-topics';

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
    getPublishedTopics(),
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
    `> ${siteConfig.description}`,
    '',
    '## Generated',
    `- generatedAt: ${generatedAt}`,
    `- source: astro content collections (${LLM_COLLECTIONS.join(', ')})`,
    '',
    '## LLM usage notes',
    '- This file is generated automatically on deploy; do not edit by hand.',
    `- Compact catalog: ${toAbsoluteUrl('/llms.txt', site)} (this file).`,
    `- Full encyclopedia dump: ${toAbsoluteUrl('/llms-full.txt', site)} (every topic, glossary entry, tool, and mapped ATT&CK technique).`,
    '- Prefer JSON indexes for structured metadata; prefer `.md` URLs or `llms-full.txt` for full prose.',
    '- Prefer `topics.json` for topic metadata, phases, MITRE IDs, and markdown URLs.',
    '- Prefer `glossary.json` for glossary metadata and markdown URLs.',
    '- Prefer `tools.json` for the security tool catalog.',
    '- Prefer `techniques.json` for MITRE ATT&CK techniques mapped to topics on this site.',
    ...(features.attackPaths
      ? [
          '- Prefer `attack-paths.json` for attack path graphs: steps, types, connections, and per-step MITRE techniques.',
          '- Attack path HTML pages include an interactive diagram; step types are color-coded: initial, lateral, privilege, persistence, exfiltration.',
          '- Step `connections` in YAML define diagram edges; if omitted, steps chain sequentially.',
        ]
      : []),
    '- For offensive topics, filter `category=offensive` then group/order by `phase`.',
    '- Use `/topics/<topic-slug>.md` for full topic markdown plus extracted action headings and commands.',
    '- Use `/glossary/<term-slug>.md` for full glossary markdown.',
    '- `phase` is the canonical offensive classification field on topics.',
    '',
    '## Important URLs',
    `- Site home: ${toAbsoluteUrl('/', site)}`,
    `- About: ${toAbsoluteUrl('/about', site)}`,
    `- Topics overview: ${toAbsoluteUrl('/topics', site)}`,
    `- Glossary overview: ${toAbsoluteUrl('/glossary', site)}`,
    `- MITRE techniques index: ${toAbsoluteUrl('/techniques', site)}`,
    `- Security tools index: ${toAbsoluteUrl('/tools', site)}`,
    `- Machine-readable topic index (JSON): ${toAbsoluteUrl('/topics.json', site)}`,
    `- Machine-readable glossary index (JSON): ${toAbsoluteUrl('/glossary.json', site)}`,
    `- Machine-readable tools index (JSON): ${toAbsoluteUrl('/tools.json', site)}`,
    `- Machine-readable ATT&CK index (JSON): ${toAbsoluteUrl('/techniques.json', site)}`,
    `- Raw markdown topic endpoint pattern: ${toAbsoluteUrl('/topics/<topic-slug>.md', site)}`,
    `- Raw markdown glossary endpoint pattern: ${toAbsoluteUrl('/glossary/<term-slug>.md', site)}`,
    `- Full content dump: ${toAbsoluteUrl('/llms-full.txt', site)}`,
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
      return `- ${toAbsoluteUrl(`/glossary/${entry.slug}`, site)} | md: ${toAbsoluteUrl(`/glossary/${entry.slug}.md`, site)} | category: ${entry.data.category} | mitre: ${mitre} | ${entry.data.title} | ${oneLine(entry.data.description)}`;
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

export function buildGlossaryJsonPayload(snapshot: LlmContentSnapshot) {
  const { site, generatedAt, glossary } = snapshot;
  const sorted = [...glossary].sort((a, b) => a.data.title.localeCompare(b.data.title));

  return {
    site,
    generatedAt,
    totalGlossary: sorted.length,
    glossary: sorted.map((entry) => ({
      slug: entry.slug,
      url: toAbsoluteUrl(`/glossary/${entry.slug}`, site),
      markdownUrl: toAbsoluteUrl(`/glossary/${entry.slug}.md`, site),
      title: entry.data.title,
      description: entry.data.description,
      category: entry.data.category,
      relatedTerms: entry.data.relatedTerms ?? [],
      tools: entry.data.tools ?? [],
      mitreTechniques: entry.data.mitreTechniques ?? [],
      kubernetesVersion: entry.data.kubernetesVersion ?? null,
    })),
  };
}

export function buildToolsJsonPayload(snapshot: LlmContentSnapshot) {
  const { site, generatedAt } = snapshot;
  const catalog = Object.entries(tools)
    .map(([key, tool]) => ({
      key,
      name: tool.name,
      url: tool.url,
      types: getToolTypes(tool),
      description: tool.description ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    site,
    generatedAt,
    htmlUrl: toAbsoluteUrl('/tools', site),
    totalTools: catalog.length,
    tools: catalog,
  };
}

export function buildTechniquesJsonPayload(snapshot: LlmContentSnapshot) {
  const { site, generatedAt, topics } = snapshot;
  const catalog = getAllMitreTechniques().slice().sort((a, b) => a.id.localeCompare(b.id));
  const offensiveTopics = topics.filter((topic) => topic.data.category === 'offensive');

  const topicsByTechnique = new Map<string, Array<{ slug: string; title: string; url: string }>>();
  for (const topic of offensiveTopics) {
    for (const id of topic.data.mitreTechniques ?? []) {
      const list = topicsByTechnique.get(id) ?? [];
      list.push({
        slug: topic.slug,
        title: topic.data.title,
        url: toAbsoluteUrl(`/topics/${topic.slug}`, site),
      });
      topicsByTechnique.set(id, list);
    }
  }

  const techniques = catalog.map((technique) => ({
    id: technique.id,
    name: technique.name,
    tactic: technique.tactic,
    description: technique.description,
    url: technique.url,
    htmlAnchor: toAbsoluteUrl(`/techniques#${technique.id}`, site),
    topics: topicsByTechnique.get(technique.id) ?? [],
  }));

  const mapped = techniques.filter((technique) => technique.topics.length > 0);

  return {
    site,
    generatedAt,
    htmlUrl: toAbsoluteUrl('/techniques', site),
    totalTechniques: techniques.length,
    mappedTechniques: mapped.length,
    techniques,
  };
}

export function buildLlmsFullTxt(snapshot: LlmContentSnapshot): string {
  const { site: origin, generatedAt, topics, glossary } = snapshot;
  const sortedTopics = [...topics].sort((a, b) => a.data.title.localeCompare(b.data.title));
  const sortedGlossary = [...glossary].sort((a, b) => a.data.title.localeCompare(b.data.title));
  const toolCatalog = getAllTools().slice().sort((a, b) => a.name.localeCompare(b.name));
  const techniquesPayload = buildTechniquesJsonPayload(snapshot);
  const mappedTechniques = techniquesPayload.techniques.filter((technique) => technique.topics.length > 0);

  const parts: string[] = [
    '# kubernetes-security.cloud',
    '',
    `> ${siteConfig.description}`,
    '',
    'This file is the full encyclopedia dump for language models. For a compact catalog of URLs, use /llms.txt.',
    '',
    `generatedAt: ${generatedAt}`,
    `source: ${toAbsoluteUrl('/llms-full.txt', origin)}`,
    `catalog: ${toAbsoluteUrl('/llms.txt', origin)}`,
    '',
    '## About',
    '',
    siteConfig.description,
    '',
    'This reference covers Kubernetes security terminology, offensive and defensive topics, MITRE ATT&CK mappings, and related tooling.',
    '',
    `HTML: ${toAbsoluteUrl('/about', origin)}`,
    '',
    '## Glossary',
    '',
  ];

  for (const entry of sortedGlossary) {
    parts.push(
      `### ${entry.data.title}`,
      '',
      `HTML: ${toAbsoluteUrl(`/glossary/${entry.slug}`, origin)}`,
      `Markdown: ${toAbsoluteUrl(`/glossary/${entry.slug}.md`, origin)}`,
      '',
      glossaryToMarkdown(entry).trim(),
      '',
    );
  }

  parts.push('## Topics', '');

  for (const topic of sortedTopics) {
    parts.push(
      `### ${topic.data.title}`,
      '',
      `HTML: ${toAbsoluteUrl(`/topics/${topic.slug}`, origin)}`,
      `Markdown: ${toAbsoluteUrl(`/topics/${topic.slug}.md`, origin)}`,
      '',
      topicToMarkdown(topic).trim(),
      '',
    );
  }

  parts.push(
    '## Tools',
    '',
    `HTML: ${toAbsoluteUrl('/tools', origin)}`,
    `JSON: ${toAbsoluteUrl('/tools.json', origin)}`,
    '',
  );

  for (const tool of toolCatalog) {
    const types = getToolTypes(tool).join(', ');
    parts.push(
      `### ${tool.name}`,
      '',
      `- URL: ${tool.url}`,
      `- Types: ${types}`,
      ...(tool.description ? [`- ${tool.description}`] : []),
      '',
    );
  }

  parts.push(
    '## MITRE ATT&CK techniques mapped on this site',
    '',
    `HTML: ${toAbsoluteUrl('/techniques', origin)}`,
    `JSON: ${toAbsoluteUrl('/techniques.json', origin)}`,
    '',
  );

  for (const technique of mappedTechniques) {
    const topicList = technique.topics.map((topic) => `${topic.title} (${topic.url})`).join('; ') || 'none';
    parts.push(
      `### ${technique.id} ${technique.name}`,
      '',
      `- Tactic: ${technique.tactic}`,
      `- ATT&CK: ${technique.url}`,
      `- Topics: ${topicList}`,
      '',
      technique.description,
      '',
    );
  }

  if (features.attackPaths && snapshot.attackPaths.length > 0) {
    parts.push('## Attack paths', '');
    for (const path of [...snapshot.attackPaths].sort((a, b) => a.data.title.localeCompare(b.data.title))) {
      parts.push(
        `### ${path.data.title}`,
        '',
        `HTML: ${toAbsoluteUrl(`/attack-paths/${path.id}`, origin)}`,
        '',
        path.data.description,
        '',
      );
      for (const [index, step] of path.data.steps.entries()) {
        const command = step.command
          ? (Array.isArray(step.command) ? step.command.join('\n') : step.command)
          : '';
        parts.push(
          `#### Step ${index + 1}. ${step.title}`,
          '',
          `- Type: ${step.type}`,
          `- MITRE: ${step.mitreTechnique ?? 'none'}`,
          '',
          step.description.trim(),
          '',
          ...(command ? ['```', command, '```', ''] : []),
        );
      }
    }
  }

  parts.push('');
  return parts.join('\n');
}

export const LLM_INDEX_FILES = [
  'llms.txt',
  'llms-full.txt',
  'topics.json',
  'glossary.json',
  'tools.json',
  'techniques.json',
  'attack-paths.json',
] as const;

export const LLM_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300',
} as const;
