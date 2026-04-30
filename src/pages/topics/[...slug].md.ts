import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

function toYamlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    return `\n${value.map((item) => `  - ${toYamlScalar(item)}`).join('\n')}`;
  }

  return toYamlScalar(value);
}

function toYamlScalar(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const str = String(value);
  return JSON.stringify(str);
}

function formatPhase(phase?: string): string | null {
  if (!phase) return null;
  return phase
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueTrimmed(items: string[], max = 8): string[] {
  const unique = new Set<string>();
  for (const raw of items) {
    const item = raw.trim();
    if (!item) continue;
    if (!unique.has(item)) {
      unique.add(item);
    }
    if (unique.size >= max) break;
  }
  return [...unique];
}

function extractActionHeadings(body: string): string[] {
  const matches = [...body.matchAll(/^###\s+(.+)$/gm)];
  return uniqueTrimmed(matches.map((match) => match[1]));
}

function extractOrderedSteps(body: string): string[] {
  const matches = [...body.matchAll(/^\d+\.\s+(.+)$/gm)];
  return uniqueTrimmed(matches.map((match) => match[1]));
}

function extractCommands(body: string): string[] {
  const blocks = [...body.matchAll(/```(?:bash|sh|shell)\n([\s\S]*?)```/gm)];
  const lines = blocks
    .flatMap((block) => block[1].split('\n'))
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  return uniqueTrimmed(lines, 10);
}

export async function getStaticPaths() {
  const topics = await getCollection('topics');
  return topics.map((topic) => ({
    params: { slug: topic.slug },
    props: { topic },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { topic } = props;
  const topicPhase = topic.data.phase ?? topic.data.offensiveType;
  const phaseLabel = formatPhase(topicPhase);
  const actionHeadings = extractActionHeadings(topic.body);
  const orderedSteps = extractOrderedSteps(topic.body);
  const keyCommands = extractCommands(topic.body);
  const primaryAction = actionHeadings[0] ?? topic.data.title;

  const frontmatterLines = [
    '---',
    `title: ${toYamlValue(topic.data.title)}`,
    `description: ${toYamlValue(topic.data.description)}`,
    `category: ${toYamlValue(topic.data.category)}`,
    `phase: ${toYamlValue(topicPhase ?? null)}`,
    `offensiveType: ${toYamlValue(topicPhase ?? null)}`,
    `impact: ${toYamlValue(topic.data.impact)}`,
    `mitigation: ${toYamlValue(topic.data.mitigation)}`,
    `tools: ${toYamlValue(topic.data.tools ?? [])}`,
    `mitreTechniques: ${toYamlValue(topic.data.mitreTechniques ?? [])}`,
    `kubernetesVersion: ${toYamlValue(topic.data.kubernetesVersion ?? null)}`,
    `createdAt: ${toYamlValue(topic.data.createdAt ? topic.data.createdAt.toISOString() : null)}`,
    '---',
    '',
  ];

  const actionFocusLines = [
    '## LLM Action Focus',
    '',
    `- Primary action: ${primaryAction}`,
    `- Category: ${topic.data.category}`,
    `- Phase: ${phaseLabel ?? 'N/A'}`,
    `- Objective: ${topic.data.description}`,
    '',
    '### Action checklist',
    ...(orderedSteps.length > 0
      ? orderedSteps.map((step) => `- ${step}`)
      : actionHeadings.map((heading) => `- ${heading}`)),
    '',
    '### Key commands',
    ...(keyCommands.length > 0 ? keyCommands.map((command) => `- \`${command}\``) : ['- No direct shell command extracted']),
    '',
    '---',
    '',
  ];

  const markdown = `${frontmatterLines.join('\n')}${actionFocusLines.join('\n')}${topic.body}\n`;

  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
