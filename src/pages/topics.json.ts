import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const SITE_URL = 'https://kubernetes-security.cloud';

function toAbsoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
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
      title: topic.data.title,
      description: topic.data.description,
      category: topic.data.category,
      impact: topic.data.impact,
      mitigation: topic.data.mitigation,
      tools: topic.data.tools ?? [],
      mitreTechniques: topic.data.mitreTechniques ?? [],
      kubernetesVersion: topic.data.kubernetesVersion ?? null,
      createdAt: topic.data.createdAt ? topic.data.createdAt.toISOString() : null,
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
