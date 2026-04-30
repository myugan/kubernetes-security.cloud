import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE_URL = 'https://kubernetes-security.cloud';

function toAbsoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function toList(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  return [value.trim()].filter(Boolean);
}

export const GET: APIRoute = async () => {
  const topics = await getCollection('topics');
  const sortedTopics = [...topics].sort((a, b) => a.data.title.localeCompare(b.data.title));

  const payload = {
    site: SITE_URL,
    generatedAt: new Date().toISOString(),
    totalTopics: sortedTopics.length,
    topics: sortedTopics.map((topic) => ({
      slug: topic.slug,
      url: toAbsoluteUrl(`/topics/${topic.slug}`),
      markdownUrl: toAbsoluteUrl(`/topics/${topic.slug}.md`),
      title: topic.data.title,
      description: topic.data.description,
      category: topic.data.category,
      offensiveType: topic.data.offensiveType ?? null,
      phase: topic.data.offensiveType ?? null,
      impact: toList(topic.data.impact),
      mitigation: toList(topic.data.mitigation),
      tools: topic.data.tools ?? [],
      mitreTechniques: topic.data.mitreTechniques ?? [],
      kubernetesVersion: topic.data.kubernetesVersion ?? null,
      createdAt: topic.data.createdAt ? topic.data.createdAt.toISOString() : null,
      llmActionFocus: {
        category: topic.data.category,
        phase: topic.data.offensiveType ?? null,
        objective: topic.data.description,
      },
    })),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
