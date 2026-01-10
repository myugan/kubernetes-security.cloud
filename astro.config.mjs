import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import yaml from '@rollup/plugin-yaml';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), mdx()],
  markdown: {
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
