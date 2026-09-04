import type { APIRoute } from 'astro';
import {
  buildLlmsFullTxt,
  LLM_CACHE_HEADERS,
  loadLlmContent,
} from '../lib/llm-content';

export const prerender = true;

export const GET: APIRoute = async () => {
  const snapshot = await loadLlmContent();
  return new Response(buildLlmsFullTxt(snapshot), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...LLM_CACHE_HEADERS,
    },
  });
};
