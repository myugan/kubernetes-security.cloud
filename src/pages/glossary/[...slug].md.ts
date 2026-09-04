import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { glossaryToMarkdown } from '../../lib/llm-markdown';

export async function getStaticPaths() {
  const entries = await getCollection('glossary');
  return entries.map((entry) => ({
    params: { slug: entry.slug },
    props: { entry },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  return new Response(glossaryToMarkdown(props.entry), {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
