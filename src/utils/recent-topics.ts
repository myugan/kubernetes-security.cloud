import type { CollectionEntry } from 'astro:content';

/** Topics with `createdAt`, newest first (for “recently added” UI). */
export function getRecentTopics(
  topics: CollectionEntry<'topics'>[],
  limit: number
): CollectionEntry<'topics'>[] {
  return [...topics]
    .filter((t) => t.data.createdAt != null)
    .sort((a, b) => {
      const ta = a.data.createdAt!.getTime();
      const tb = b.data.createdAt!.getTime();
      return tb - ta;
    })
    .slice(0, limit);
}

export function formatTopicDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
