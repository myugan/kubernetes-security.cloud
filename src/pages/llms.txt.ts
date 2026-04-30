import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE_URL = 'https://kubernetes-security.cloud';

function toAbsoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export const GET: APIRoute = async () => {
  const topics = await getCollection('topics');
  const sortedTopics = [...topics].sort((a, b) => a.data.title.localeCompare(b.data.title));
  const offensiveTopics = sortedTopics.filter((topic) => topic.data.category === 'offensive');
  const defensiveTopics = sortedTopics.filter((topic) => topic.data.category === 'defensive');
  const fundamentalTopics = sortedTopics.filter((topic) => topic.data.category === 'fundamental');

  const lines: string[] = [
    '# kubernetes-security.cloud',
    '',
    '> Kubernetes security reference topics for offensive, defensive, and fundamental techniques.',
    '',
    '## LLM usage notes',
    '- Prefer `topics.json` for structured metadata and filtering.',
    '- Use `/topics/<topic-slug>.md` when you need full markdown plus action checklist and commands.',
    '- `phase` is equivalent to `offensiveType` for offensive topics.',
    '',
    '## Important URLs',
    `- Topics overview: ${toAbsoluteUrl('/topics')}`,
    `- Machine-readable topic index (JSON): ${toAbsoluteUrl('/topics.json')}`,
    `- Raw markdown topic endpoint pattern: ${toAbsoluteUrl('/topics/<topic-slug>.md')}`,
    `- Sitemap: ${toAbsoluteUrl('/sitemap-index.xml')}`,
    '',
    '## Topic totals',
    `- Total topics: ${sortedTopics.length}`,
    `- Offensive topics: ${offensiveTopics.length}`,
    `- Defensive topics: ${defensiveTopics.length}`,
    `- Fundamental topics: ${fundamentalTopics.length}`,
    '',
    '## Topic pages',
    ...sortedTopics.map((topic) => {
      const phaseValue = topic.data.offensiveType ?? 'n/a';
      return `- ${toAbsoluteUrl(`/topics/${topic.slug}`)} | markdown: ${toAbsoluteUrl(`/topics/${topic.slug}.md`)} | category: ${topic.data.category} | phase: ${phaseValue} | ${topic.data.title} | ${topic.data.description}`;
    }),
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
