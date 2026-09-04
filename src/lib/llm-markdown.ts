/**
 * Canonical markdown documents for LLM endpoints (`/topics/*.md`, `/glossary/*.md`, llms-full).
 */

import type { CollectionEntry } from 'astro:content';
import { formatPhase } from './taxonomy';

function toYamlScalar(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(String(value));
}

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

function uniqueTrimmed(items: string[], max = 8): string[] {
  const unique = new Set<string>();
  for (const raw of items) {
    const item = raw.trim();
    if (!item) continue;
    if (!unique.has(item)) unique.add(item);
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

function frontmatter(fields: Array<[string, unknown]>): string {
  const lines = ['---', ...fields.map(([key, value]) => `${key}: ${toYamlValue(value)}`), '---', ''];
  return lines.join('\n');
}

export function topicToMarkdown(topic: CollectionEntry<'topics'>): string {
  const topicPhase = topic.data.phase ?? topic.data.offensiveType;
  const phaseLabel = formatPhase(topicPhase);
  const actionHeadings = extractActionHeadings(topic.body);
  const orderedSteps = extractOrderedSteps(topic.body);
  const keyCommands = extractCommands(topic.body);
  const primaryAction = actionHeadings[0] ?? topic.data.title;

  const header = frontmatter([
    ['title', topic.data.title],
    ['description', topic.data.description],
    ['category', topic.data.category],
    ['phase', topicPhase ?? null],
    ['offensiveType', topicPhase ?? null],
    ['impact', topic.data.impact],
    ['mitigation', topic.data.mitigation],
    ['tools', topic.data.tools ?? []],
    ['mitreTechniques', topic.data.mitreTechniques ?? []],
    ['kubernetesVersion', topic.data.kubernetesVersion ?? null],
    ['createdAt', topic.data.createdAt ? topic.data.createdAt.toISOString() : null],
  ]);

  const actionFocus = [
    '## LLM Action Focus',
    '',
    `- Primary action: ${primaryAction}`,
    `- Category: ${topic.data.category}`,
    `- Phase: ${phaseLabel || 'N/A'}`,
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
  ].join('\n');

  return `${header}${actionFocus}${topic.body.trim()}\n`;
}

export function glossaryToMarkdown(entry: CollectionEntry<'glossary'>): string {
  const header = frontmatter([
    ['title', entry.data.title],
    ['description', entry.data.description],
    ['category', entry.data.category],
    ['relatedTerms', entry.data.relatedTerms ?? []],
    ['tools', entry.data.tools ?? []],
    ['mitreTechniques', entry.data.mitreTechniques ?? []],
    ['kubernetesVersion', entry.data.kubernetesVersion ?? null],
  ]);

  return `${header}${entry.body.trim()}\n`;
}
