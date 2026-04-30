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

export async function getStaticPaths() {
  const topics = await getCollection('topics');
  return topics.map((topic) => ({
    params: { slug: topic.slug },
    props: { topic },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { topic } = props;

  const frontmatterLines = [
    '---',
    `title: ${toYamlValue(topic.data.title)}`,
    `description: ${toYamlValue(topic.data.description)}`,
    `category: ${toYamlValue(topic.data.category)}`,
    `impact: ${toYamlValue(topic.data.impact)}`,
    `mitigation: ${toYamlValue(topic.data.mitigation)}`,
    `tools: ${toYamlValue(topic.data.tools ?? [])}`,
    `mitreTechniques: ${toYamlValue(topic.data.mitreTechniques ?? [])}`,
    `kubernetesVersion: ${toYamlValue(topic.data.kubernetesVersion ?? null)}`,
    `createdAt: ${toYamlValue(topic.data.createdAt ? topic.data.createdAt.toISOString() : null)}`,
    '---',
    '',
  ];

  const markdown = `${frontmatterLines.join('\n')}${topic.body}\n`;

  return new Response(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
