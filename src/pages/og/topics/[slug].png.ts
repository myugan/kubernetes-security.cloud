import type { APIRoute } from 'astro';
import { renderTopicOgPng } from '../../../utils/render-topic-og';
import { getPublishedTopics } from '../../../utils/published-topics';

export const prerender = true;

export async function getStaticPaths() {
  const topics = await getPublishedTopics();
  return topics.map((topic) => ({
    params: { slug: topic.slug },
    props: {
      title: topic.data.title,
      description: topic.data.description,
      category: topic.data.category,
      phase: topic.data.phase ?? topic.data.offensiveType ?? null,
    },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const png = await renderTopicOgPng({
    title: props.title,
    description: props.description,
    category: props.category,
    phase: props.phase,
  });

  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=604800, immutable',
    },
  });
};
