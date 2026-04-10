import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import yaml from '@rollup/plugin-yaml';
import rehypeMarkdownCallouts from './scripts/rehype-markdown-callouts.mjs';
import rehypeWrapTables from './scripts/rehype-wrap-tables.mjs';

const markdownRehypePlugins = [rehypeMarkdownCallouts, rehypeWrapTables];

// https://astro.build/config
export default defineConfig({
  site: 'https://kubernetes-security.cloud',
  integrations: [
    tailwind(),
    mdx({
      rehypePlugins: markdownRehypePlugins,
    }),
    sitemap(),
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
