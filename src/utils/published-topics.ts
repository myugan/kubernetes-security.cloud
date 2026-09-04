import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * Scheduled publishing is evaluated at build time.
 * A topic with `createdAt` in the future is omitted until a build on or after that date.
 * Topics with no `createdAt` are treated as already published.
 */
export function isTopicPublished(createdAt: Date | undefined, now = new Date()): boolean {
  if (!createdAt) return true;
  return createdAt.getTime() <= now.getTime();
}

export async function getPublishedTopics(): Promise<CollectionEntry<'topics'>[]> {
  return getCollection('topics', ({ data }) => isTopicPublished(data.createdAt));
}
