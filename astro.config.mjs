import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import yaml from '@rollup/plugin-yaml';
import rehypeMarkdownCallouts from './scripts/rehype-markdown-callouts.mjs';
import rehypeTrimTrailingShikiLines from './scripts/rehype-trim-trailing-shiki-lines.mjs';
import rehypeWrapTables from './scripts/rehype-wrap-tables.mjs';
import llmIndexIntegration from './integrations/llm-index.mjs';

/** Trim runs after Shiki (Astro appends user rehype plugins after built-in `rehypeShiki`). */
const markdownRehypePlugins = [rehypeMarkdownCallouts, rehypeWrapTables, rehypeTrimTrailingShikiLines];

/**
 * Public origin for canonical URLs, sitemap, and og:image.
 * Prefer the host this build is deployed to (previews) so `/og/topics/*.png` resolves on the same origin.
 */
function resolvePublicSite() {
  const raw =
    process.env.URL?.trim() ||
    process.env.DEPLOY_PRIME_URL?.trim() ||
    process.env.CF_PAGES_URL?.trim() ||
    (process.env.VERCEL_URL?.trim() ? `https://${process.env.VERCEL_URL.trim()}` : '') ||
    'https://kubernetes-security.cloud';
  const noTrail = raw.replace(/\/$/, '');
  return noTrail.startsWith('http') ? noTrail : `https://${noTrail}`;
}

// https://astro.build/config
export default defineConfig({
  site: resolvePublicSite(),
  integrations: [
    tailwind(),
    mdx({
      rehypePlugins: markdownRehypePlugins,
    }),
    sitemap(),
    llmIndexIntegration(),
  ],
  markdown: {
    rehypePlugins: markdownRehypePlugins,
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
      transformers: [
        {
          pre(node) {
            // Add data-language attribute to pre element for CSS targeting
            const lang = this.options.lang || '';
            node.properties['data-language'] = lang;
          }
        }
      ]
    }
  },
  vite: {
    plugins: [yaml()]
  }
});
