import type { APIRoute } from 'astro';
import {
  buildTechniquesJsonPayload,
  LLM_CACHE_HEADERS,
  loadLlmContent,
} from '../lib/llm-content';

export const prerender = true;

export const GET: APIRoute = async () => {
  const snapshot = await loadLlmContent();
  return new Response(JSON.stringify(buildTechniquesJsonPayload(snapshot), null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...LLM_CACHE_HEADERS,
    },
  });
};
