import type { APIRoute } from 'astro';
import { topicToMarkdown } from '../../lib/llm-markdown';
import { getPublishedTopics } from '../../utils/published-topics';

export async function getStaticPaths() {
  const topics = await getPublishedTopics();
  return topics.map((topic) => ({
    params: { slug: topic.slug },
    props: { topic },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  return new Response(topicToMarkdown(props.topic), {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
