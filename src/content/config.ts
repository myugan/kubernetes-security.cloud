import { defineCollection, z } from 'astro:content';

const glossaryCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['concept', 'component', 'resource', 'security', 'attack', 'defense']),
    relatedTerms: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(), // Tool names (referenced from src/data/tools.ts)
    mitreTechniques: z.array(z.string()).optional(), // e.g., ['T1610', 'T1059']
    kubernetesVersion: z.union([z.string(), z.array(z.string())]).optional(), // e.g., '1.28+' or ['1.26', '1.27', '1.28+']
  }),
});

const topicsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(['offensive', 'defensive', 'fundamental']),
    impact: z.union([z.string(), z.array(z.string())]),
    mitigation: z.union([z.string(), z.array(z.string())]),
    tools: z.array(z.string()).optional(), // Tool names (referenced from src/data/tools.ts)
    references: z.string().optional(), // References in markdown format
    mitreTechniques: z.array(z.string()).optional(), // e.g., ['T1610', 'T1059']
    kubernetesVersion: z.union([z.string(), z.array(z.string())]).optional(), // e.g., '1.28+' or ['1.26', '1.27', '1.28+']
  }),
});

const attackPathsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    mitreTechniques: z.array(z.string()).optional(), // e.g., ['T1610', 'T1059']
    kubernetesVersion: z.union([z.string(), z.array(z.string())]), // Required: e.g., '1.28+' or ['1.26', '1.27', '1.28+']
    steps: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      type: z.enum(['initial', 'lateral', 'privilege', 'persistence', 'exfiltration']),
      connections: z.array(z.string()).optional(),
      mitreTechnique: z.string().optional(), // Individual step can have a technique
      command: z.union([z.string(), z.array(z.string())]).optional(), // Command(s) that attacker might execute
    })),
  }),
});

export const collections = {
  'glossary': glossaryCollection,
  'topics': topicsCollection,
  'attack-paths': attackPathsCollection,
};
