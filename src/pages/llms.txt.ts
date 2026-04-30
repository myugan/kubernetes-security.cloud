import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE_URL = 'https://kubernetes-security.cloud';

function toAbsoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const GET: APIRoute = async () => {
  const topics = await getCollection('topics');
  const sortedTopics = [...topics].sort((a, b) => a.data.title.localeCompare(b.data.title));

  const lines: string[] = [
    '# kubernetes-security.cloud',
    '',
    '> Kubernetes security reference topics for offensive, defensive, and fundamental techniques.',
    '',
    '## Important URLs',
    `- Topics overview: ${toAbsoluteUrl('/topics')}`,
    `- Machine-readable topic index (JSON): ${toAbsoluteUrl('/topics.json')}`,
    `- Sitemap: ${toAbsoluteUrl('/sitemap-index.xml')}`,
    '',
    '## Topic pages',
    ...sortedTopics.map((topic) => `- ${toAbsoluteUrl(`/topics/${topic.slug}`)} | ${topic.data.title} | ${topic.data.description}`),
    '',
  ];

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
