/**
 * Verifies LLM index files were emitted during static build.
 * Generation runs via prerendered API routes that read content collections.
 */

import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const LLM_FILES = [
  'llms.txt',
  'llms-full.txt',
  'topics.json',
  'glossary.json',
  'tools.json',
  'techniques.json',
  'attack-paths.json',
];

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function countFromLlmsTxt(text) {
  const topicLines = (text.split('## Topic pages')[1]?.split('## Glossary pages')[0] ?? '')
    .split('\n')
    .filter((l) => l.startsWith('- https://')).length;
  const glossaryLines = (text.split('## Glossary pages')[1]?.split('## Attack path')[0] ?? '')
    .split('\n')
    .filter((l) => l.startsWith('- https://')).length;
  const attackMatch = text.match(/- Attack paths: (\d+)/);
  return {
    topics: topicLines,
    glossary: glossaryLines,
    attackPaths: attackMatch ? Number(attackMatch[1]) : 0,
  };
}

/** @returns {import('astro').AstroIntegration} */
export default function llmIndexIntegration() {
  return {
    name: 'kubernetes-security-llm-index',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const dist = dir.pathname;
        const missing = [];

        for (const file of LLM_FILES) {
          const path = join(dist, file);
          if (!(await fileExists(path))) {
            missing.push(file);
          }
        }

        if (missing.length > 0) {
          logger.warn(
            `LLM index incomplete — missing after build: ${missing.join(', ')}. ` +
              'Ensure LLM index API routes under src/pages export prerender = true.'
          );
          return;
        }

        const llmsPath = join(dist, 'llms.txt');
        const llmsText = await readFile(llmsPath, 'utf8');
        const counts = countFromLlmsTxt(llmsText);

        logger.info(
          `LLM index synced from content collections → ` +
            `${counts.topics} topics, ${counts.glossary} glossary, ${counts.attackPaths} attack paths ` +
            `(llms.txt + llms-full.txt + JSON indexes)`
        );
      },
    },
  };
}
